import React, { useState } from 'react';
import { BananaModel } from './types';
import { TabSmartEdit } from './components/TabSmartEdit';
import { TabRecreate } from './components/TabRecreate';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'edit' | 'recreate'>('edit');
  const [selectedModel, setSelectedModel] = useState<BananaModel>(BananaModel.NANO_BANANA);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 shadow-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-500/20">
               <span className="text-xl font-bold text-gray-900">B</span>
             </div>
             <h1 className="text-2xl font-bold tracking-tight text-white">Banana <span className="text-yellow-500">Pro</span> <span className="text-sm font-normal text-gray-400 ml-2 border-l border-gray-700 pl-2">影像创作中心</span></h1>
          </div>
          
          {/* Model Switcher */}
          <div className="flex items-center gap-4 bg-gray-800 p-1.5 rounded-full border border-gray-700">
            <button
              onClick={() => setSelectedModel(BananaModel.NANO_BANANA)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedModel === BananaModel.NANO_BANANA
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🍌 Nano Banana
            </button>
            <button
              onClick={() => setSelectedModel(BananaModel.NANO_BANANA_2)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedModel === BananaModel.NANO_BANANA_2
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🍌 Nano Banana 2
            </button>
            <button
              onClick={() => setSelectedModel(BananaModel.NANO_BANANA_PRO)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
                selectedModel === BananaModel.NANO_BANANA_PRO
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              ✨ Pro 专业版
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        
        {/* Tab Navigation */}
        <div className="flex mb-8 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('edit')}
            className={`pb-4 px-6 text-lg font-medium transition-all relative ${
              activeTab === 'edit' 
                ? 'text-yellow-500' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            🎨 智能修图
            {activeTab === 'edit' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 shadow-[0_-2px_10px_rgba(234,179,8,0.5)]"></div>}
          </button>
          <button
            onClick={() => setActiveTab('recreate')}
            className={`pb-4 px-6 text-lg font-medium transition-all relative ${
              activeTab === 'recreate' 
                ? 'text-yellow-500' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            🔄 重塑创作
            {activeTab === 'recreate' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 shadow-[0_-2px_10px_rgba(234,179,8,0.5)]"></div>}
          </button>
        </div>

        {/* Tab Content - Keep both mounted but toggle visibility */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div style={{ display: activeTab === 'edit' ? 'block' : 'none' }}>
            <TabSmartEdit model={selectedModel} />
          </div>
          <div style={{ display: activeTab === 'recreate' ? 'block' : 'none' }}>
            <TabRecreate model={selectedModel} />
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-6 mt-12 bg-gray-950">
        <div className="container mx-auto text-center text-gray-600 text-sm">
          <p>© 2025 Banana Pro Studio. Powered by Gemini {
            selectedModel === BananaModel.NANO_BANANA_PRO ? '3 Pro' : 
            selectedModel === BananaModel.NANO_BANANA_2 ? '3.1 Flash' : '2.5 Flash'
          }.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;