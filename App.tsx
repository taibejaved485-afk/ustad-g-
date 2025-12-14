import React, { useState, useRef, useEffect } from 'react';
import { Subject, Message, ChatState, ImageStyle } from './types';
import { generateTutorResponse, generateEducationalImage } from './services/geminiService';
import { SubjectCard } from './components/SubjectCard';
import { MessageBubble } from './components/MessageBubble';

// Mapping subjects to visual properties
const SUBJECTS_CONFIG = [
  { id: Subject.ENGLISH, icon: 'fas fa-book-open', color: 'bg-indigo-500' },
  { id: Subject.URDU, icon: 'fas fa-pen-nib', color: 'bg-emerald-600' },
  { id: Subject.MATHS, icon: 'fas fa-calculator', color: 'bg-rose-500' },
  { id: Subject.PHYSICS, icon: 'fas fa-atom', color: 'bg-violet-600' },
  { id: Subject.CHEMISTRY, icon: 'fas fa-flask', color: 'bg-amber-500' },
  { id: Subject.BIOLOGY, icon: 'fas fa-dna', color: 'bg-teal-500' },
  { id: Subject.COMPUTER, icon: 'fas fa-laptop-code', color: 'bg-blue-500' },
  { id: Subject.PAK_STUDIES, icon: 'fas fa-landmark', color: 'bg-green-600' },
];

// Extend Window interface for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    selectedSubject: null,
  });

  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [visualStyle, setVisualStyle] = useState<ImageStyle>('Scientific');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatState.messages, chatState.isLoading]);

  const handleSubjectSelect = (subject: Subject) => {
    setChatState({
      messages: [{
        id: 'welcome',
        role: 'model',
        text: `Assalam-o-Alaikum! I am your ${subject} tutor. 
Ask me any question, and I will explain it simply for you. 
(Mujhse koi bhi sawal pouchein, main asani se samjhaunga).`,
        timestamp: Date.now(),
      }],
      isLoading: false,
      selectedSubject: subject,
    });
  };

  const handleBackToHome = () => {
    setChatState({
      messages: [],
      isLoading: false,
      selectedSubject: null,
    });
  };

  const handleClearChat = () => {
    if (!chatState.selectedSubject) return;

    if (window.confirm("Are you sure you want to clear the chat history?")) {
      setChatState(prev => ({
        ...prev,
        messages: [{
          id: Date.now().toString(),
          role: 'model',
          text: `Assalam-o-Alaikum! I am your ${prev.selectedSubject} tutor. 
Ask me any question, and I will explain it simply for you. 
(Mujhse koi bhi sawal pouchein, main asani se samjhaunga).`,
          timestamp: Date.now(),
        }],
        isLoading: false
      }));
    }
  };

  // Voice Input Logic
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    // Intelligent Language Selection
    recognition.lang = chatState.selectedSubject === Subject.ENGLISH ? 'en-US' : 'ur-PK';
    
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => (prev ? prev + ' ' : '') + transcript);
    };

    recognition.start();
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || chatState.isLoading || !chatState.selectedSubject) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: Date.now(),
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true
    }));
    setInputText('');

    try {
      const history = chatState.messages.map(m => ({ role: m.role, text: m.text }));
      
      const response = await generateTutorResponse(userMessage.text, history, chatState.selectedSubject);

      const botMessageId = (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botMessageId,
        role: 'model',
        text: response.text,
        sources: response.sources,
        timestamp: Date.now(),
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, botMessage],
        isLoading: false
      }));

      // Generate 3D Visualization in background with selected style
      const imageResult = await generateEducationalImage(userMessage.text, chatState.selectedSubject, visualStyle);
      
      setChatState(prev => {
          const updatedMessages = prev.messages.map(msg => {
              if (msg.id === botMessageId) {
                  if (imageResult) {
                      return { ...msg, imageUrl: imageResult };
                  } else {
                      // Mark as error if image generation failed
                      return { ...msg, imageError: true };
                  }
              }
              return msg;
          });
          return { ...prev, messages: updatedMessages };
      });

    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Sorry, mere internet mein kuch masla aa gaya hai. Please dubara try karein. (Network error, please retry).",
        timestamp: Date.now(),
        isError: true,
      };
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isLoading: false
      }));
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputText(suggestion);
    inputRef.current?.focus();
  };

  const getSuggestions = () => {
    if (chatState.isLoading) return [];
    const lastMsg = chatState.messages[chatState.messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'model' || lastMsg.isError) return [];
    if (lastMsg.id === 'welcome') return [];

    return [
      "Can you explain this further?",
      "Give me another example.",
      "Explain this in Urdu."
    ];
  };

  // --- VIEW: HOME (Subject Selection) ---
  if (!chatState.selectedSubject) {
    return (
      <div className="min-h-screen relative overflow-hidden flex flex-col animate-fade-in bg-slate-50">
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-none">
          {/* Moving Gradient Blobs */}
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
          
          {/* Floating Icons */}
          <div className="absolute top-1/4 left-1/4 text-indigo-200 text-6xl opacity-30 animate-float">
             <i className="fas fa-atom"></i>
          </div>
          <div className="absolute bottom-1/4 right-1/4 text-rose-200 text-6xl opacity-30 animate-float-reverse">
             <i className="fas fa-square-root-alt"></i>
          </div>
          <div className="absolute top-1/3 right-10 text-emerald-200 text-5xl opacity-30 animate-float" style={{animationDelay: '1s'}}>
             <i className="fas fa-dna"></i>
          </div>
          <div className="absolute bottom-10 left-10 text-blue-200 text-7xl opacity-30 animate-float-reverse" style={{animationDelay: '2s'}}>
             <i className="fas fa-code"></i>
          </div>
        </div>

        {/* Header */}
        <header className="relative z-10 bg-white/80 backdrop-blur-md p-6 shadow-sm sticky top-0">
          <div className="max-w-4xl mx-auto flex items-center justify-center animate-scale-in">
             <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 text-white w-10 h-10 rounded-xl flex items-center justify-center mr-3 shadow-lg transform transition hover:rotate-12 hover:scale-110 cursor-pointer">
                <i className="fas fa-graduation-cap text-xl"></i>
             </div>
             <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight">
               Ustaad AI
             </h1>
          </div>
        </header>

        {/* Hero Section */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center mb-10 max-w-2xl animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-black text-slate-800 mb-4 tracking-tight drop-shadow-sm">
              Apni Parhai Ko <span className="text-indigo-600 inline-block animate-wiggle cursor-default">Fun</span> Banayein
            </h2>
            <p className="text-slate-600 text-lg md:text-xl font-medium bg-white/60 inline-block px-4 py-2 rounded-full backdrop-blur-sm border border-white/50 shadow-sm">
              🤖 Choose a subject and start learning in 3D!
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 w-full max-w-5xl">
            {SUBJECTS_CONFIG.map((config, idx) => (
              <SubjectCard
                key={config.id}
                index={idx}
                subject={config.id}
                icon={config.icon}
                color={config.color}
                onClick={handleSubjectSelect}
              />
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="relative z-10 p-4 text-center text-slate-500 text-sm font-medium animate-fade-in delay-300">
          Powered by Gemini 2.5 • Made for 🇵🇰 Students
        </div>
      </div>
    );
  }

  // --- VIEW: CHAT INTERFACE ---
  const currentSubjectConfig = SUBJECTS_CONFIG.find(s => s.id === chatState.selectedSubject);
  const suggestions = getSuggestions();

  return (
    <div className="flex flex-col h-screen bg-slate-50 animate-fade-in relative">
       {/* Subtle animated background for chat too */}
       <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
       </div>

      {/* Chat Header */}
      <header className={`${currentSubjectConfig?.color || 'bg-indigo-600'} text-white p-4 shadow-lg flex items-center justify-between sticky top-0 z-20 transition-colors duration-500`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBackToHome}
            className="p-2 hover:bg-white/20 rounded-full transition transform hover:scale-110 active:scale-95"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <div className="animate-fade-in-up">
            <h2 className="font-bold text-lg leading-tight flex items-center gap-2">
              {chatState.selectedSubject}
            </h2>
            <span className="text-xs opacity-90 flex items-center gap-1 bg-black/10 px-2 py-0.5 rounded-full w-fit">
              <i className="fas fa-circle text-[8px] text-green-300 animate-pulse"></i> Online
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleClearChat}
            className="p-2 hover:bg-white/20 rounded-full transition text-white/90 transform hover:scale-110 active:scale-95"
            title="Clear Chat"
          >
            <i className="fas fa-trash-alt"></i>
          </button>
          <div className="bg-white/20 p-2 rounded-lg transform transition hover:rotate-12 hover:scale-110 cursor-pointer shadow-inner">
             <i className={`${currentSubjectConfig?.icon} text-xl`}></i>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide relative z-10">
        <div className="max-w-3xl mx-auto flex flex-col">
          {chatState.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          
          {chatState.isLoading && (
            <div className="flex items-start mb-6 animate-pop-in">
              <span className="text-xs font-semibold text-emerald-600 ml-1 mr-2 mt-1">Ustaad AI</span>
              <div className="bg-white px-5 py-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-2">
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                 <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
              </div>
            </div>
          )}

          {/* Suggestion Chips */}
          {!chatState.isLoading && suggestions.length > 0 && (
             <div className="flex flex-wrap gap-2 mt-2 ml-1 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
               {suggestions.map((s, idx) => (
                 <button
                   key={idx}
                   onClick={() => handleSuggestionClick(s)}
                   className="text-xs md:text-sm bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-full hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition shadow-sm active:scale-95 transform hover:-translate-y-0.5 font-medium hover-shimmer"
                 >
                   {s}
                 </button>
               ))}
             </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white/90 backdrop-blur-md p-4 border-t border-slate-200 sticky bottom-0 z-20 pb-safe">
        <div className="max-w-3xl mx-auto">
          
          {/* Visual Style Selector */}
          <div className="flex justify-center mb-2 animate-fade-in-up">
            <div className="bg-slate-100 rounded-full p-1 flex items-center gap-1 shadow-inner border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 px-2 uppercase tracking-wider flex items-center gap-1">
                  <i className="fas fa-palette"></i> Style:
                </span>
                <select 
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value as ImageStyle)}
                className="bg-white text-xs font-semibold text-indigo-600 rounded-full px-3 py-1 border border-indigo-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer hover:bg-indigo-50 transition"
                >
                    <option value="Scientific">Scientific 3D</option>
                    <option value="Cartoon">Fun Cartoon</option>
                    <option value="Realistic">Realistic</option>
                    <option value="Blueprint">Blueprint</option>
                    <option value="Low Poly">Low Poly</option>
                </select>
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Listening..." : `Ask a question about ${chatState.selectedSubject}...`}
              className={`w-full bg-slate-100 text-slate-800 rounded-full pl-5 pr-24 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition shadow-inner text-base
                ${isListening ? 'ring-2 ring-red-400 bg-red-50 placeholder-red-400' : ''}`}
              disabled={chatState.isLoading}
            />
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {/* Mic Button */}
              <button
                type="button"
                onClick={toggleListening}
                disabled={chatState.isLoading}
                className={`p-3 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover-shimmer
                  ${isListening 
                    ? 'bg-red-500 text-white animate-pulse shadow-red-300 shadow-lg' 
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:scale-110 active:scale-95'
                  }`}
                title="Speak to ask"
              >
                <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'}`}></i>
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim() || chatState.isLoading}
                className={`p-3 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover-shimmer
                  ${!inputText.trim() || chatState.isLoading 
                    ? 'text-slate-300 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg transform hover:scale-110 active:scale-95'
                  }`}
              >
                <i className="fas fa-paper-plane text-sm"></i>
              </button>
            </div>

          </form>
          <div className="text-center mt-2">
             <p className="text-[10px] text-slate-400">
               AI can make mistakes. Please check important info.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;