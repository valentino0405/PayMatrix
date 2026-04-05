'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useWalkthrough } from '@/lib/walkthrough-context';
import { ChevronRight, X, Sparkles, MoveRight } from 'lucide-react';

export default function WalkthroughOverlay() {
  const { isActive, currentStep, totalSteps, currentStepData, nextStep, exitWalkthrough } = useWalkthrough();
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const resizeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || !currentStepData?.target) {
      setCoords(null);
      return;
    }

    const updateCoords = () => {
      const el = document.querySelector(currentStepData.target as string);
      if (el) {
        const rect = el.getBoundingClientRect();
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      } else {
        setCoords(null);
      }
    };

    updateCoords();
    
    // Polling because some elements might appear late (e.g. modals)
    const interval = setInterval(updateCoords, 500);
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isActive, currentStepData]);

  if (!isActive) return null;

  const getTooltipClasses = () => {
    const p = currentStepData?.placement;
    if (!coords || p === 'center') return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
    if (p === 'screen-top') return "top-8 left-1/2 -translate-x-1/2";
    if (p === 'screen-bottom') return "bottom-8 left-1/2 -translate-x-1/2";
    if (p === 'screen-left') return "top-1/2 left-8 -translate-y-1/2";
    if (p === 'screen-right') return "top-1/2 right-8 -translate-y-1/2";
    
    // Fallback if no placement is specified (though all steps now have placement)
    return typeof window !== 'undefined' && coords.top < window.innerHeight / 2 
      ? "bottom-[3rem] left-1/2 -translate-x-1/2" 
      : "top-[6rem] left-1/2 -translate-x-1/2";
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden h-screen w-screen">
      {/* Dark Overlay with Hole */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-all duration-500"
        style={{
          clipPath: coords 
            ? `polygon(0% 0%, 0% 100%, ${coords.left}px 100%, ${coords.left}px ${coords.top}px, ${coords.left + coords.width}px ${coords.top}px, ${coords.left + coords.width}px ${coords.top + coords.height}px, ${coords.left}px ${coords.top + coords.height}px, ${coords.left}px 100%, 100% 100%, 100% 0%)`
            : 'none'
        }}
      />

      {/* Highlight Border */}
      {coords && (
        <div 
          className="absolute border-2 border-indigo-500 rounded-lg shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all duration-500 ease-out"
          style={{
            top: coords.top - 4,
            left: coords.left - 4,
            width: coords.width + 8,
            height: coords.height + 8,
          }}
        >
          <div className="absolute -top-2 -right-2 h-4 w-4 bg-indigo-500 rounded-full animate-ping" />
        </div>
      )}

      {/* Tooltip */}
      <div 
        className={`absolute pointer-events-auto transition-all duration-500 ease-out z-[110] ${getTooltipClasses()}`}
      >
        <div className="w-[320px] rounded-3xl border border-white/10 bg-[#111118]/95 backdrop-blur-xl p-5 shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 shadow-lg shadow-indigo-500/30">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step {currentStep + 1} of {totalSteps}</span>
            </div>
            <button 
              onClick={exitWalkthrough}
              className="h-7 w-7 flex items-center justify-center rounded-full text-slate-500 hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {currentStepData?.title && (
            <h3 className="text-[15px] font-extrabold text-white mb-1.5 leading-snug">
              {currentStepData.title}
            </h3>
          )}
          <p className="text-xs font-medium leading-relaxed text-slate-300 mb-6 whitespace-pre-wrap">
            {currentStepData?.message}
          </p>

          <div className="flex items-center justify-between gap-3">
            <button 
              onClick={exitWalkthrough}
              className="text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors"
            >
              Skip
            </button>
            <button 
              onClick={nextStep}
              className={`flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 ${currentStepData?.actionRequired ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {currentStep === totalSteps - 1 ? 'Finish' : (currentStepData?.actionRequired ? 'Interaction Required' : 'Next Step')}
              {!currentStepData?.actionRequired && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
