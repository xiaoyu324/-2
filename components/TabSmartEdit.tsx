
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BananaModel, AspectRatio, ImageResolution } from '../types';
import { editImageWithGemini } from '../services/geminiService';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

interface Props {
  model: BananaModel;
}

interface Preset {
  name: string;
  content: string;
}

export const TabSmartEdit: React.FC<Props> = ({ model }) => {
  const [image, setImage] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  const [originalSize, setOriginalSize] = useState<{ width: number; height: number } | null>(null);
  
  // 自定义预设状态
  const [customPresets, setCustomPresets] = useState<Preset[]>(() => {
    const saved = localStorage.getItem('banana_smart_edit_presets_v5');
    return saved ? JSON.parse(saved) : [
      { name: "完美绿幕", content: "将背景替换为高饱和度的纯绿色 (#00ff29) 绿幕背景。" },
      { name: "纯蓝幕", content: "将背景替换为高饱和度的纯蓝色 (#0003ff) 蓝幕背景。" },
      { name: "去除戒指", content: "去除图片中人物手上的戒指，使手指看起来自然，没有饰品。" }
    ];
  });
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  // 预设命名 UI 状态 (内置弹窗，非浏览器 prompt)
  const [isNamingPreset, setIsNamingPreset] = useState(false);
  const [tempPresetName, setTempPresetName] = useState('');

  // 工具状态
  const [activeTool, setActiveTool] = useState<'brush' | 'eraser' | 'none'>('none');
  const [brushSize, setBrushSize] = useState(40);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // 数据状态
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.ORIGINAL);

  // 撤销历史
  const [history, setHistory] = useState<ImageData[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPos = useRef<{x: number, y: number} | null>(null);

  // 预设持久化存储
  useEffect(() => {
    localStorage.setItem('banana_smart_edit_presets_v5', JSON.stringify(customPresets));
  }, [customPresets]);

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d', { willReadFrequently: true }), []);

  const initCanvas = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current;
    if (canvas) {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
            ctx.clearRect(0, 0, width, height);
            const blankState = ctx.getImageData(0, 0, width, height);
            setHistory([blankState]);
        }
    }
  }, []);

  const loadImage = useCallback((src: string, name?: string) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setImage(src);
      // 记录原始分辨率
      setOriginalSize({ width: img.naturalWidth, height: img.naturalHeight });
      if (name) setOriginalFileName(name);
      setResultImages([]);
      setHistory([]);
      setAspectRatio(AspectRatio.ORIGINAL);
      initCanvas(img.width, img.height);
    };
  }, [initCanvas]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (evt.target?.result) loadImage(evt.target.result as string, file.name);
        };
        reader.readAsDataURL(file);
    }
  };

  const useAsInput = (imgUrl: string) => loadImage(imgUrl);

  // 内置 UI 弹窗命名预设
  const openNamingModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!prompt.trim()) {
      alert("请先在指令框输入要保存的内容。");
      return;
    }
    setTempPresetName("自定义预设 " + (customPresets.length + 1));
    setIsNamingPreset(true);
  };

  const confirmSavePreset = () => {
    if (!tempPresetName.trim()) return;
    const newPreset = { name: tempPresetName.trim(), content: prompt.trim() };
    setCustomPresets(prev => [...prev, newPreset]);
    setIsNamingPreset(false);
    setShowPresetMenu(true);
  };

  const removeCustomPreset = (index: number) => {
    setCustomPresets(customPresets.filter((_, i) => i !== index));
  };

  // 核心优化：确保下载结果还原为上传时的【原始分辨率】
  const downloadResult = async (imgUrl: string) => {
    if (!originalSize) return;
    setIsLoading(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imgUrl;
      await new Promise((resolve) => (img.onload = resolve));

      const hiddenCanvas = document.createElement('canvas');
      // 设置为原始文件分辨率，确保 1k 还是 1k，2k 还是 2k
      hiddenCanvas.width = originalSize.width;
      hiddenCanvas.height = originalSize.height;
      const ctx = hiddenCanvas.getContext('2d');
      
      if (ctx) {
        // 使用高质量图像平滑技术进行缩放还原
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, originalSize.width, originalSize.height);
        
        const dataUrl = hiddenCanvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = originalFileName ? `edited-${originalFileName}` : `banana-edit-${Date.now()}.png`;
        link.click();
      }
    } catch (err) {
      console.error("Resolution Preservation Download Error:", err);
      const link = document.createElement('a');
      link.href = imgUrl;
      link.download = originalFileName ? `edited-${originalFileName}` : `banana-edit-${Date.now()}.png`;
      link.click();
    } finally {
      setIsLoading(false);
    }
  };

  const undo = () => {
      if (history.length <= 1) return;
      const newHistory = history.slice(0, -1);
      const prevState = newHistory[newHistory.length - 1];
      const ctx = getCtx();
      if (ctx && prevState) {
          ctx.putImageData(prevState, 0, 0);
          setHistory(newHistory);
      }
  };

  const getCoordinates = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handleGenerate = async (overridePrompt?: string, skipMask: boolean = false) => {
    if (!image) return;
    setIsLoading(true);
    setError(null);
    try {
      let maskBase64: string | undefined = undefined;
      if (!skipMask && canvasRef.current && history.length > 1) {
          maskBase64 = canvasRef.current.toDataURL('image/png');
      }

      // 根据原始尺寸决定生成质量，但绝不传 4K (在 service 层已拦截，这里按逻辑选择 1K 或 2K)
      let targetQuality = ImageResolution.RES_1K;
      if (originalSize) {
        const maxSide = Math.max(originalSize.width, originalSize.height);
        if (maxSide > 1500) targetQuality = ImageResolution.RES_2K;
      }

      const res = await editImageWithGemini({
        model,
        imageBase64: image,
        maskBase64,
        prompt: overridePrompt || prompt,
        aspectRatio: aspectRatio,
        quality: targetQuality, // 动态选择生成质量，最高 2K
      });
      setResultImages(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const applyPreset = (content: string) => {
    setPrompt(content);
    setShowPresetMenu(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-140px)] min-h-[600px] relative">
      <div className="flex flex-col gap-4 h-full">
         <div className="bg-gray-800 p-3 rounded-xl border border-gray-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
                {!image ? (
                    <label className="cursor-pointer bg-yellow-500 hover:bg-yellow-400 text-gray-900 px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-yellow-500/10">
                        ➕ 上传图片
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                    </label>
                ) : (
                    <>
                     <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                        <button onClick={() => setActiveTool(activeTool === 'brush' ? 'none' : 'brush')} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTool === 'brush' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>🖌️ 涂抹</button>
                        <button onClick={() => setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser')} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTool === 'eraser' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>🧼 橡皮擦</button>
                     </div>
                     <button onClick={undo} disabled={history.length <= 1} className="p-2 text-gray-400 hover:text-white disabled:opacity-30 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                     </button>
                     <button onClick={() => {setImage(null); setOriginalFileName(''); setOriginalSize(null); setResultImages([]); setHistory([]);}} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                     </button>
                    </>
                )}
            </div>
            {image && (activeTool === 'brush' || activeTool === 'eraser') && (
                <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700">
                    <span className="text-xs text-gray-400 font-bold">笔触</span>
                    <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-24 accent-yellow-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                </div>
            )}
         </div>

         <div ref={containerRef} className={`relative flex-1 bg-gray-900 border-2 rounded-xl overflow-hidden flex items-center justify-center ${!image ? 'border-dashed border-gray-700' : 'border-gray-800'}`}>
            {!image ? (
                <div className="text-center text-gray-600 pointer-events-none p-6">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <p>点击上传或拖拽图片</p>
                </div>
            ) : (
                <div className="relative max-w-full max-h-full shadow-2xl">
                    <img src={image} className="max-w-full max-h-[50vh] object-contain block" alt="Source" draggable={false} />
                    <canvas ref={canvasRef} onPointerDown={(e) => {
                      if (activeTool === 'none') return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setIsDrawing(true);
                      const { x, y } = getCoordinates(e);
                      lastPos.current = { x, y };
                      const ctx = getCtx();
                      if (!ctx) return;
                      ctx.lineCap = 'round';
                      ctx.lineJoin = 'round';
                      ctx.lineWidth = brushSize;
                      if (activeTool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
                      else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#ff0000'; }
                      ctx.beginPath();
                      ctx.moveTo(x, y);
                      ctx.lineTo(x, y);
                      ctx.stroke();
                    }} onPointerMove={(e) => {
                      if (!isDrawing) return;
                      const { x, y } = getCoordinates(e);
                      const ctx = getCtx();
                      if (!ctx || !lastPos.current) return;
                      ctx.beginPath();
                      ctx.moveTo(lastPos.current.x, lastPos.current.y);
                      ctx.lineTo(x, y);
                      ctx.stroke();
                      lastPos.current = { x, y };
                    }} onPointerUp={(e) => {
                      if (isDrawing) {
                        setIsDrawing(false);
                        e.currentTarget.releasePointerCapture(e.pointerId);
                        lastPos.current = null;
                        const ctx = getCtx();
                        const canvas = canvasRef.current;
                        if (ctx && canvas) {
                            const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            setHistory(prev => [...prev, data].slice(-20));
                        }
                        if (ctx) ctx.globalCompositeOperation = 'source-over';
                      }
                    }} className={`absolute inset-0 w-full h-full opacity-60 touch-none ${activeTool !== 'none' ? 'cursor-crosshair' : ''}`} />
                </div>
            )}
            {!image && <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleFileUpload} />}
         </div>

         <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-4 shrink-0">
             <div className="flex flex-col gap-3">
                 <Select label="画幅比例" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}>
                    <option value={AspectRatio.ORIGINAL}>保留原比例</option>
                    <option value={AspectRatio.SQUARE}>1:1 正方形</option>
                    <option value={AspectRatio.PORTRAIT_3_4}>3:4 竖幅</option>
                    <option value={AspectRatio.PORTRAIT_4_5}>4:5 竖幅</option>
                    <option value={AspectRatio.PORTRAIT_9_16}>9:16 全屏</option>
                    <option value={AspectRatio.LANDSCAPE_16_9}>16:9 宽屏</option>
                 </Select>
                 
                 <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-bold uppercase">常用快捷指令</p>
                    <div className="flex gap-2 relative">
                        <button onClick={() => applyPreset("将背景替换为高饱和度的纯绿色 (#00ff29) 绿幕背景。")} className="bg-gray-700 hover:bg-gray-600 text-[11px] px-2 py-2 rounded text-gray-200 border border-gray-600 flex-1 flex items-center justify-center gap-1">
                          <span className="w-2 h-2 bg-[#00ff29] rounded-full"></span> 纯绿幕
                        </button>
                        <button onClick={() => applyPreset("将背景替换为高饱和度的纯蓝色 (#0003ff) 蓝幕背景。")} className="bg-gray-700 hover:bg-gray-600 text-[11px] px-2 py-2 rounded text-gray-200 border border-gray-600 flex-1 flex items-center justify-center gap-1">
                          <span className="w-2 h-2 bg-[#0003ff] rounded-full"></span> 纯蓝幕
                        </button>
                        <button onClick={() => applyPreset("去除图片中人物手上的戒指，使手指看起来自然，没有饰品。")} className="bg-gray-700 hover:bg-gray-600 text-[11px] px-2 py-2 rounded text-gray-200 border border-gray-600 flex-1">💍 去戒指</button>
                        
                        <div className="relative">
                          <button onClick={() => setShowPresetMenu(!showPresetMenu)} className="bg-indigo-600 hover:bg-indigo-500 text-[11px] px-3 py-2 rounded text-white font-bold flex items-center gap-1 transition-all active:scale-95">📋 预设库</button>
                          {showPresetMenu && (
                            <div className="absolute bottom-full right-0 mb-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[100] p-2 max-h-64 overflow-y-auto animate-in fade-in zoom-in duration-200">
                               <div className="flex items-center justify-between p-2 border-b border-gray-800 mb-2 sticky top-0 bg-gray-900 z-10">
                                  <span className="text-xs font-bold text-gray-400">预设管理</span>
                                  <button onClick={openNamingModal} className="text-[10px] text-yellow-500 hover:text-yellow-400 font-bold underline">💾 存当前指令</button>
                               </div>
                               {customPresets.length === 0 && <p className="text-[10px] text-gray-600 text-center py-4">暂无保存的预设</p>}
                               {customPresets.map((p, i) => (
                                 <div key={i} className="group flex items-center justify-between p-2 hover:bg-gray-800 rounded cursor-pointer transition-colors" onClick={() => applyPreset(p.content)}>
                                    <span className="text-[11px] text-gray-300 truncate pr-2" title={p.content}>{p.name}</span>
                                    <button onClick={(e) => { e.stopPropagation(); removeCustomPreset(i); }} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 px-1 font-bold">×</button>
                                 </div>
                               ))}
                            </div>
                          )}
                        </div>
                    </div>
                 </div>
             </div>

             <div className="space-y-3">
                 <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="输入编辑指令 (例如：移除路人，改为日落光效)..." className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-yellow-500 outline-none h-20 resize-none" />
                 <div className="flex gap-3">
                     <Button onClick={() => handleGenerate()} disabled={!image} isLoading={isLoading} className="flex-1 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 text-gray-900 font-bold">✨ 开始执行</Button>
                     <Button onClick={() => handleGenerate("Remove text, logos and subtitlies.", true)} disabled={!image} variant="secondary" isLoading={isLoading} className="w-1/3 py-3 border border-gray-600 text-gray-300">🧼 清理文字</Button>
                 </div>
             </div>
             {error && <p className="text-red-400 text-xs bg-red-900/20 p-2 rounded">{error}</p>}
         </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-white flex items-center gap-2">🎨 生成结果</h3><span className="text-xs text-gray-500">原图分辨率保留下载</span></div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
             {resultImages.map((img, idx) => (
                 <div key={idx} className="group relative bg-black rounded-lg border border-gray-700 overflow-hidden shadow-lg">
                     <img src={img} alt="Result" className="w-full h-auto object-contain max-h-[500px]" />
                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                        <Button onClick={() => useAsInput(img)} variant="primary" className="scale-90 text-xs">🎨 循环编辑</Button>
                        <button onClick={() => downloadResult(img)} className="text-white text-xs hover:text-yellow-400 bg-black/50 px-4 py-1.5 rounded-full border border-white/20">⬇️ 下载原图</button>
                     </div>
                 </div>
             ))}
             {resultImages.length === 0 && !isLoading && <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-40"><p>暂无生成结果</p></div>}
             {isLoading && <div className="h-full flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-yellow-500 animate-pulse">正在精修中...</p></div>}
          </div>
      </div>

      {/* 预设命名 UI 弹窗 */}
      {isNamingPreset && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h4 className="text-lg font-bold text-white mb-4">保存为新预设</h4>
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">预设名称</p>
              <input 
                autoFocus
                type="text" 
                value={tempPresetName} 
                onChange={(e) => setTempPresetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmSavePreset()}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-yellow-500 outline-none mb-6"
                placeholder="例如：怀旧港风底图"
              />
              <div className="flex gap-3">
                 <button onClick={() => setIsNamingPreset(false)} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium">取消</button>
                 <button onClick={confirmSavePreset} className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-gray-900 rounded-lg transition-colors font-bold">确认保存</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
