
import React, { useState, useEffect, useRef } from 'react';
import { BananaModel, AspectRatio, ImageResolution } from '../types';
import { recreateImageWithGemini } from '../services/geminiService';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

interface Props {
  model: BananaModel;
}

interface Preset {
  name: string;
  content: string;
}

export const TabRecreate: React.FC<Props> = ({ model }) => {
  const [refImage, setRefImage] = useState<string | null>(null);
  const [charImage, setCharImage] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  
  const [customPresets, setCustomPresets] = useState<Preset[]>(() => {
    const saved = localStorage.getItem('banana_recreate_presets_v5');
    return saved ? JSON.parse(saved) : [
      { name: "极简极客", content: "极简极客风格，冷峻色调，高科技感。" },
      { name: "赛博霓虹", content: "赛博朋克霓虹，雨夜街道，绚丽光影。" },
      { name: "复古电影", content: "复古电影感，胶片颗粒，暖色调调色。" }
    ];
  });
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const [isNamingPreset, setIsNamingPreset] = useState(false);
  const [tempPresetName, setTempPresetName] = useState('');

  const [prompts, setPrompts] = useState<string>(() => localStorage.getItem('banana_recreate_prompts') || '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => (localStorage.getItem('banana_recreate_ratio') as AspectRatio) || AspectRatio.ORIGINAL);
  const [count, setCount] = useState(() => Number(localStorage.getItem('banana_recreate_count') || 1));
  const [quality, setQuality] = useState<ImageResolution>(() => (localStorage.getItem('banana_recreate_quality') as ImageResolution) || ImageResolution.RES_1K);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<{prompt: string, images: string[], error?: string}[]>([]);
  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const [isDraggingChar, setIsDraggingChar] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => { localStorage.setItem('banana_recreate_prompts', prompts); }, [prompts]);
  useEffect(() => { localStorage.setItem('banana_recreate_ratio', aspectRatio); }, [aspectRatio]);
  useEffect(() => { localStorage.setItem('banana_recreate_count', count.toString()); }, [count]);
  useEffect(() => { localStorage.setItem('banana_recreate_quality', quality); }, [quality]);
  useEffect(() => { localStorage.setItem('banana_recreate_presets_v5', JSON.stringify(customPresets)); }, [customPresets]);

  const openNamingModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!prompts.trim()) {
      alert("请输入创作描述后再保存。");
      return;
    }
    setTempPresetName("自定义描述 " + (customPresets.length + 1));
    setIsNamingPreset(true);
  };

  const confirmSavePreset = () => {
    if (!tempPresetName.trim()) return;
    const newPreset = { name: tempPresetName.trim(), content: prompts.trim() };
    setCustomPresets(prev => [...prev, newPreset]);
    setIsNamingPreset(false);
    setShowPresetMenu(true);
  };

  const removeCustomPreset = (index: number) => {
    setCustomPresets(customPresets.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'ref' | 'char') => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
             if(evt.target?.result) {
                 if (type === 'ref') {
                    setRefImage(evt.target.result as string);
                    setOriginalFileName(file.name);
                    setAspectRatio(AspectRatio.ORIGINAL);
                 } else {
                    setCharImage(evt.target.result as string);
                 }
             }
        };
        reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    const promptList = prompts.split('\n').map(p => p.trim()).filter(p => p !== '');
    
    // 逻辑：如果有图片但没描述词，则认为是一个空描述词的生成
    const effectivePrompts = promptList.length > 0 ? promptList : (refImage || charImage ? [""] : []);
    
    if (effectivePrompts.length === 0) return;

    setIsLoading(true);
    setError(null);
    setBatchResults([]);
    stopRef.current = false;

    try {
      for (const p of effectivePrompts) {
        if (stopRef.current) {
          setError("已停止生成。");
          break;
        }
        try {
          const images = await recreateImageWithGemini({ 
            model, 
            referenceImageBase64: refImage || undefined, 
            characterImageBase64: charImage || undefined,
            prompt: p, 
            aspectRatio, 
            numberOfImages: count, 
            quality 
          });
          setBatchResults(prev => [...prev, { prompt: p, images }]);
        } catch (err: any) {
          setBatchResults(prev => [...prev, { prompt: p, images: [], error: err.message }]);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const applyPreset = (content: string) => {
    setPrompts(prev => prev ? prev + '\n' + content : content);
    setShowPresetMenu(false);
  };

  const useAsReference = (imgUrl: string) => {
     setRefImage(imgUrl);
     setAspectRatio(AspectRatio.ORIGINAL);
  };

  const handleStop = () => {
    stopRef.current = true;
  };

  // 按钮是否可点击
  const isGenerateDisabled = !prompts.trim() && !refImage && !charImage;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-140px)] min-h-[600px] relative">
      <div className="flex flex-col gap-4 h-full overflow-y-auto pr-2 custom-scrollbar">
        
        {/* 并列布局容器 */}
        <div className="flex gap-4 shrink-0">
          {/* 人物肖像上传 - 占 1/4 */}
          <div 
            className={`w-1/4 bg-gray-900 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all relative group overflow-hidden ${isDraggingChar ? 'border-indigo-500 bg-gray-800' : 'border-gray-700'} ${charImage ? 'border-solid h-32' : 'h-32'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingChar(true); }}
            onDragLeave={() => setIsDraggingChar(false)}
            onDrop={(e) => { e.preventDefault(); setIsDraggingChar(false); const file = e.dataTransfer.files?.[0]; if (file?.type.startsWith('image/')) handleFileUpload({ target: { files: [file] } } as any, 'char'); }}
          >
            {!charImage ? (
               <div className="text-center px-2">
                  <label className="cursor-pointer text-indigo-400 hover:text-indigo-300 font-bold text-xs">👤 肖像<input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'char')} /></label>
                  <p className="text-[9px] text-gray-500 mt-1 leading-tight">人物身份<br/>一致性</p>
               </div>
            ) : (
               <div className="relative w-full h-full flex items-center justify-center p-1 bg-gray-950/50">
                 <img src={charImage} alt="Character" className="max-w-full max-h-full object-contain" />
                 <button onClick={() => setCharImage(null)} className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">×</button>
               </div>
            )}
          </div>

          {/* 构图参考图上传 - 占 3/4 */}
          <div 
            className={`flex-1 bg-gray-900 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all relative group overflow-hidden ${isDraggingRef ? 'border-yellow-500 bg-gray-800' : 'border-gray-700'} ${refImage ? 'border-solid h-32' : 'h-32'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingRef(true); }}
            onDragLeave={() => setIsDraggingRef(false)}
            onDrop={(e) => { e.preventDefault(); setIsDraggingRef(false); const file = e.dataTransfer.files?.[0]; if (file?.type.startsWith('image/')) handleFileUpload({ target: { files: [file] } } as any, 'ref'); }}
          >
            {!refImage ? (
               <div className="text-center px-4">
                  <label className="cursor-pointer text-yellow-500 hover:text-yellow-400 font-bold text-xs">🖼️ 上传构图参考图<input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'ref')} /></label>
                  <p className="text-[10px] text-gray-500 mt-1">控制画面的构图、光影与整体氛围</p>
               </div>
            ) : (
               <div className="relative w-full h-full flex items-center justify-center p-1"><img src={refImage} alt="Reference" className="max-w-full max-h-full object-contain" /><button onClick={() => {setRefImage(null); setOriginalFileName('');}} className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">×</button></div>
            )}
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4 flex-1">
           <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-400 uppercase">创作描述 (Prompt)</label>
                <div className="relative flex items-center gap-2">
                   <button onClick={openNamingModal} className="text-[10px] text-yellow-500 hover:text-yellow-400 font-bold underline">💾 存当前描述</button>
                   <button onClick={() => setShowPresetMenu(!showPresetMenu)} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold border-l border-gray-700 pl-2">📋 预设库</button>
                   {showPresetMenu && (
                     <div className="absolute top-full right-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[100] p-2 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                        {customPresets.length === 0 && <p className="text-[10px] text-gray-600 text-center py-2">暂无预设</p>}
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
              <textarea value={prompts} onChange={(e) => setPrompts(e.target.value)} className="w-full h-32 bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-yellow-500 outline-none resize-none" placeholder="批量输入描述词，每行一个描述词..." />
           </div>

           <div className="grid grid-cols-2 gap-4">
              <Select label="画幅比例" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}>
                  <option value={AspectRatio.ORIGINAL}>保留参考图比例</option>
                  <option value={AspectRatio.SQUARE}>1:1 正方形</option>
                  <option value={AspectRatio.PORTRAIT_3_4}>3:4 竖幅</option>
                  <option value={AspectRatio.PORTRAIT_4_5}>4:5 竖幅</option>
                  <option value={AspectRatio.PORTRAIT_9_16}>9:16 全屏</option>
                  <option value={AspectRatio.LANDSCAPE_16_9}>16:9 宽屏</option>
              </Select>
              <Select label="创作质量" value={quality} onChange={(e) => setQuality(e.target.value as ImageResolution)}>
                  <option value={ImageResolution.RES_1K}>标准高清 (1K)</option>
                  <option value={ImageResolution.RES_2K}>专业画质 (2K)</option>
                  <option value={ImageResolution.RES_4K}>极致细节 (4K)</option>
              </Select>
           </div>

           <Select label="生成数量" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              <option value={1}>生成 1 张</option>
              <option value={2}>生成 2 张</option>
              <option value={3}>生成 3 张</option>
              <option value={4}>生成 4 张</option>
           </Select>

           {isLoading ? (
             <Button onClick={handleStop} variant="secondary" className="w-full py-4 text-lg font-bold bg-red-600 hover:bg-red-700 text-white border-none">⏹️ 停止生成</Button>
           ) : (
             <Button onClick={handleGenerate} disabled={isGenerateDisabled} className="w-full py-4 text-lg font-bold">🚀 立即开启重塑</Button>
           )}
           {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-full flex flex-col">
         <div className="flex items-center justify-between mb-4 px-1"><h3 className="text-lg font-bold text-white flex items-center gap-2">🖼️ 创作成果</h3></div>
         <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            <div className="space-y-8">
               {batchResults.map((result, bIdx) => (
                  <div key={bIdx} className="space-y-3">
                     <div className="flex items-center gap-2 border-l-2 border-yellow-500 pl-3">
                        <span className="text-xs font-bold text-gray-400 uppercase">描述词 {bIdx + 1}:</span>
                        <span className="text-xs text-gray-300 truncate max-w-[200px]" title={result.prompt}>{result.prompt || "(无描述词)"}</span>
                     </div>
                     {result.error ? (
                        <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-xs">
                           生成失败: {result.error}
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {result.images.map((imgUrl, idx) => (
                              <div key={idx} className="group relative rounded-lg overflow-hidden border border-gray-700 bg-black aspect-auto shadow-lg">
                                 <img src={imgUrl} alt="Result" className="w-full h-full object-cover" />
                                 <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3 backdrop-blur-sm p-4 text-center">
                                    <Button onClick={() => useAsReference(imgUrl)} variant="primary" className="w-full text-xs py-1.5">🔄 设为参考图</Button>
                                    <a href={imgUrl} download={originalFileName || `banana-recreate-${Date.now()}.png`} className="text-white text-xs hover:text-yellow-400 underline">下载当前图片</a>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               ))}
            </div>
            {batchResults.length === 0 && !isLoading && <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-40"><p>等待创意灵感生成...</p></div>}
            {isLoading && (
               <div className="mt-8 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <div className="animate-pulse text-yellow-500 text-sm">Gemini 正在批量重绘世界...</div>
                  <div className="text-[10px] text-gray-500 mt-2">正在处理第 {batchResults.length + 1} 个描述词</div>
               </div>
            )}
         </div>
      </div>

      {isNamingPreset && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h4 className="text-lg font-bold text-white mb-4">保存为创作预设</h4>
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">预设名称</p>
              <input autoFocus type="text" value={tempPresetName} onChange={(e) => setTempPresetName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-yellow-500 outline-none mb-6" placeholder="例如：赛博朋克电影质感" />
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
