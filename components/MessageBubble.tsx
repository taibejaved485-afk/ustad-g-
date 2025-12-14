import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { generateSpeechFromText, decodePCM } from '../services/geminiService';
import Markdown from 'react-markdown';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handlePlayAudio = async () => {
    if (audioState === 'playing') {
      sourceNodeRef.current?.stop();
      setAudioState('idle');
      return;
    }

    // Initialize AudioContext on user gesture
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    const ctx = audioContextRef.current;
    
    // Resume if suspended (browser policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    setAudioState('loading');

    try {
      let buffer = audioBufferRef.current;
      
      // If we haven't generated the audio yet, fetch it
      if (!buffer) {
        const base64Audio = await generateSpeechFromText(message.text);
        if (!base64Audio) {
          throw new Error("Failed to generate audio");
        }
        buffer = decodePCM(base64Audio, ctx);
        audioBufferRef.current = buffer;
      }

      // Create source and play
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        setAudioState('idle');
        sourceNodeRef.current = null;
      };

      source.start();
      sourceNodeRef.current = source;
      setAudioState('playing');

    } catch (err) {
      console.error("Audio playback error:", err);
      setAudioState('idle');
      alert("Sorry, could not play audio explanation.");
    }
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 animate-pop-in`}>
      <div className={`max-w-[90%] md:max-w-[75%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Role Label */}
        <span className={`text-xs mb-1 font-semibold ${isUser ? 'text-indigo-600 mr-1' : 'text-emerald-600 ml-1'}`}>
          {isUser ? 'You' : 'Ustaad AI'}
        </span>

        {/* Bubble */}
        <div
          className={`px-5 py-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed transition-shadow hover:shadow-md
            ${isUser 
              ? 'bg-indigo-600 text-white rounded-tr-none whitespace-pre-wrap' 
              : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
            }
            ${message.isError ? 'bg-red-50 border-red-200 text-red-600' : ''}
          `}
        >
          {isUser ? (
            message.text
          ) : (
            <Markdown 
              className="prose prose-sm max-w-none prose-slate
                prose-p:my-2 prose-p:leading-relaxed
                prose-headings:my-2 prose-headings:font-bold prose-headings:text-indigo-900
                prose-ul:my-2 prose-li:my-0.5
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-slate-900 prose-strong:font-bold
                prose-code:bg-slate-100 prose-code:text-pink-600 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-[0.9em] prose-code:before:content-none prose-code:after:content-none
              "
            >
              {message.text}
            </Markdown>
          )}
        </div>

        {/* Action Buttons (Only for Model) */}
        {!isUser && !message.isError && (
          <div className="flex items-center gap-2 mt-2 ml-1">
             <button
               onClick={handlePlayAudio}
               disabled={audioState === 'loading'}
               className={`
                 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 hover-shimmer
                 ${audioState === 'playing' 
                   ? 'bg-red-100 text-red-600 border border-red-200' 
                   : 'bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
                 }
               `}
             >
               {audioState === 'loading' ? (
                 <>
                   <i className="fas fa-circle-notch fa-spin"></i> Loading Audio...
                 </>
               ) : audioState === 'playing' ? (
                 <>
                   <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                   </span>
                   Stop Audio
                 </>
               ) : (
                 <>
                   <i className="fas fa-volume-up"></i> Listen Explanation
                 </>
               )}
             </button>
          </div>
        )}

        {/* 3D Visual Section (Handling both success and error states) */}
        {!isUser && (message.imageUrl || message.imageError) && (
          <div className="mt-3 w-full rounded-2xl overflow-hidden shadow-md border border-slate-200 animate-scale-in group">
             <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                   <i className={`fas ${message.imageError ? 'fa-exclamation-circle text-amber-500' : 'fa-cube text-indigo-500'} group-hover:animate-bounce`}></i> 
                   {message.imageError ? 'Visualization Error' : '3D Visualization'}
                </span>
                <span className="text-[10px] text-slate-400">AI Generated</span>
             </div>
             
             {message.imageError ? (
               <div className="bg-slate-50 p-8 flex flex-col items-center justify-center text-center gap-3">
                 <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-1">
                   <i className="fas fa-image-broken text-slate-400 text-2xl"></i>
                 </div>
                 <p className="text-sm text-slate-500 font-medium">Could not generate visualization</p>
                 <p className="text-xs text-slate-400 max-w-[200px]">The image generation model might be busy or encountered an error.</p>
               </div>
             ) : (
               <div className="bg-white relative overflow-hidden cursor-pointer">
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"></div>
                  <img 
                    src={message.imageUrl} 
                    alt="3D Visualization" 
                    className="w-full h-auto object-cover max-h-64 md:max-h-80 hover:scale-105 transition-transform duration-700 ease-in-out cursor-zoom-in" 
                  />
               </div>
             )}
          </div>
        )}

        {/* References Section */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 bg-slate-100 rounded-lg p-3 w-full border border-slate-200">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
              <i className="fas fa-globe"></i> References from Internet
            </h4>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-white text-blue-600 border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-50 hover:shadow-sm transition flex items-center gap-2 truncate max-w-full hover:-translate-y-0.5 transform duration-200"
                >
                  <span className="truncate max-w-[150px]">{source.title}</span>
                  <i className="fas fa-external-link-alt text-[10px]"></i>
                </a>
              ))}
            </div>
          </div>
        )}
        
        {/* Time */}
        <span className="text-[10px] text-slate-400 mt-1 mx-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

      </div>
    </div>
  );
};