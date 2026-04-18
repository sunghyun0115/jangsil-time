import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Timer, 
  Wind, 
  Smile, 
  BookOpen, 
  Dices, 
  RefreshCw, 
  ChevronLeft,
  Clock,
  Droplets,
  Sparkles,
  Waves,
  Star,
  CheckCircle2,
  Gamepad2,
  LayoutList,
  User,
  Users,
  TrendingUp,
  Mountain,
  Keyboard
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import BrickBreaker from '@/components/BrickBreaker';
import TypingGame from '@/components/TypingGame';

// Constants
const CATEGORIES = [
  { id: 'funny', name: '웃긴 이야기', icon: Smile, color: 'bg-yellow-400', prompt: 'Tell me a very short, funny joke or a hilarious "toilet thought" (shower thought style).' },
  { id: 'relaxing', name: '차분한 명상', icon: Wind, color: 'bg-blue-400', prompt: 'Give me a short, calming meditation guide or a peaceful short story.' },
  { id: 'informative', name: '유익한 상식', icon: BookOpen, color: 'bg-green-400', prompt: 'Share a fascinating "did you know" fact or a quick piece of trivia.' },
  { id: 'stock', name: '주식 정보', icon: TrendingUp, color: 'bg-red-400', prompt: 'Search for the latest major stock indices (KOSPI, KOSDAQ, S&P 500, NASDAQ, Dow Jones) and the Top 10 stocks by market cap and trading volume for both South Korea and the USA. Provide the current prices and daily change percentages. Present the information clearly in a table or list format using Markdown.' },
  { id: 'nature', name: '자연 풍경', icon: Mountain, color: 'bg-emerald-500', prompt: 'A beautiful and peaceful nature scenery, high quality, cinematic, calming. No text.' },
  { id: 'random', name: '아무거나', icon: Dices, color: 'bg-purple-400', prompt: 'Surprise me with something interesting, funny, or thought-provoking.' },
];

const TIME_OPTIONS = [
  { id: '1', name: '1분 (급함)', value: 60 },
  { id: '3', name: '3분 (보통)', value: 180 },
  { id: '5', name: '5분 (심오)', value: 300 },
];

const POOPER_RATINGS = [
  { value: 1, label: '힘들었어요', emoji: '😫' },
  { value: 2, label: '그저 그래요', emoji: '😐' },
  { value: 3, label: '시원해요', emoji: '😌' },
  { value: 4, label: '완벽해요', emoji: '✨' },
];

const WAITER_RATINGS = [
  { value: 1, label: '너무 지루해요', emoji: '🥱' },
  { value: 2, label: '그냥 그래요', emoji: '😐' },
  { value: 3, label: '시간 잘 가요', emoji: '⏳' },
  { value: 4, label: '즐거웠어요', emoji: '🥳' },
];

type UserRole = 'pooper' | 'waiter';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [step, setStep] = useState<'landing' | 'role' | 'setup' | 'content' | 'summary'>('landing');
  const [userRole, setUserRole] = useState<UserRole>('pooper');
  const [mode, setMode] = useState<'content' | 'game'>('content');
  const [gameType, setGameType] = useState<'brick' | 'typing'>('typing');
  const [selectedTime, setSelectedTime] = useState(TIME_OPTIONS[1]);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [finalTime, setFinalTime] = useState(0);
  const [rating, setRating] = useState<number | null>(null);

  const generateContent = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured. Please add it to your environment variables.');
      }

      if (selectedCategory.id === 'nature') {
        const model = "gemini-3.1-flash-image-preview";
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [{ text: selectedCategory.prompt }]
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "1K"
            }
          }
        });
        
        let imageUrl = '';
        const candidates = response.candidates;
        if (candidates && candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData) {
              imageUrl = `data:image/png;base64,${part.inlineData.data}`;
              break;
            }
          }
        }
        
        if (imageUrl) {
          setContent(imageUrl);
        } else {
          // If no image part, but there is text, show it
          if (response.text) {
            setContent(response.text);
          } else {
            setContent('풍경 이미지를 생성하는 데 실패했습니다. 다시 시도해주세요.');
          }
        }
      } else {
        const model = "gemini-3-flash-preview";
        const contextText = userRole === 'pooper' 
          ? "The user is currently in the bathroom (on the toilet) and wants a short piece of content to read."
          : "The user is waiting for a friend or partner who is currently in the bathroom. They need something to kill time while waiting outside.";

        const prompt = `
          Context: ${contextText}
          Category: ${selectedCategory.name}
          Available Time: ${selectedTime.name}
          
          Instruction: ${selectedCategory.prompt}
          The content should be in Korean. 
          Make it engaging, concise, and perfectly suited for a ${selectedTime.id} minute break.
          Use Markdown for formatting.
        `;

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: selectedCategory.id === 'stock' ? [{ googleSearch: {} }] : undefined,
          }
        });

        setContent(response.text || '콘텐츠를 불러오는 데 실패했습니다.');
      }
    } catch (error) {
      console.error("Error generating content:", error);
      let errorMessage = '알 수 없는 에러가 발생했습니다.';
      
      if (error instanceof Error) {
        const errorStr = error.message;
        if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
          errorMessage = 'API 사용 한도를 초과했습니다. 잠시(약 1분) 후 다시 시도해주시거나, 이미지 생성 대신 다른 테마를 이용해주세요.';
        } else if (errorStr.includes('403')) {
          errorMessage = 'API 접근 권한이 없습니다. API 키 설정을 확인해주세요.';
        } else {
          errorMessage = error.message;
        }
      }

      setContent(`에러가 발생했습니다: ${errorMessage}\n\n도움말: GitHub Pages에 배포한 경우, GitHub Secrets에 GEMINI_API_KEY가 설정되어 있는지 확인해주세요.`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, selectedTime, userRole]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startSession = () => {
    setStep('content');
    setIsTimerActive(true);
    if (mode === 'content') {
      generateContent();
    }
  };

  const resetSession = () => {
    setStep('setup');
    setIsTimerActive(false);
    setTimer(0);
    setContent('');
    setRating(null);
  };

  const handleFlush = () => {
    setFinalTime(timer);
    setIsTimerActive(false);
    setStep('summary');
  };

  const finishSession = () => {
    setStep('landing');
    setTimer(0);
    setContent('');
    setRating(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <div className="max-w-md mx-auto min-h-screen flex flex-col relative overflow-hidden bg-white shadow-xl">
        
        {/* Header */}
        <header className="p-6 flex items-center justify-between border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Droplets className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">장실 타임</h1>
          </div>
          {(step === 'content' || step === 'summary') && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-sm font-mono font-medium text-slate-600">
              <Clock className="w-4 h-4" />
              {formatTime(step === 'summary' ? finalTime : timer)}
            </div>
          )}
        </header>

        <main className="flex-1 p-6 flex flex-col">
          <AnimatePresence mode="wait">
            {step === 'landing' && (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
              >
                <div className="relative">
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center"
                  >
                    <Sparkles className="w-16 h-16 text-blue-500" />
                  </motion.div>
                </div>
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-slate-900">
                    지루한 대기 시간을<br />더 가치 있게
                  </h2>
                  <p className="text-slate-500 leading-relaxed">
                    화장실 안에서도, 밖에서도<br />
                    당신을 위한 맞춤형 콘텐츠와 게임
                  </p>
                </div>
                <button
                  onClick={() => setStep('role')}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                >
                  시작하기
                </button>
              </motion.div>
            )}

            {step === 'role' && (
              <motion.div
                key="role"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col justify-center space-y-8"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-slate-900">지금 어떤 상황인가요?</h3>
                  <p className="text-slate-500">상황에 맞는 모드를 선택해주세요.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => { setUserRole('pooper'); setStep('setup'); }}
                    className="p-6 rounded-3xl border-2 border-slate-100 bg-white hover:border-blue-600 hover:bg-blue-50 transition-all flex items-center gap-6 group"
                  >
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <User className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-lg font-bold text-slate-800">화장실 안이에요</h4>
                      <p className="text-sm text-slate-500">시원한 볼일과 함께 즐기기</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setUserRole('waiter'); setStep('setup'); }}
                    className="p-6 rounded-3xl border-2 border-slate-100 bg-white hover:border-blue-600 hover:bg-blue-50 transition-all flex items-center gap-6 group"
                  >
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <Users className="w-8 h-8" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-lg font-bold text-slate-800">밖에서 기다려요</h4>
                      <p className="text-sm text-slate-500">지루한 기다림을 즐겁게</p>
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => setStep('landing')}
                  className="text-slate-400 font-bold hover:text-slate-600 transition-all"
                >
                  이전으로
                </button>
              </motion.div>
            )}

            {step === 'setup' && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Timer className="w-5 h-5 text-blue-500" />
                    얼마나 {userRole === 'pooper' ? '머무르실' : '기다리실'} 건가요?
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {TIME_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setSelectedTime(option)}
                        className={cn(
                          "py-3 rounded-xl border-2 transition-all font-medium",
                          selectedTime.id === option.id
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                        )}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-blue-500" />
                    무엇을 하며 보낼까요?
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setMode('content')}
                      className={cn(
                        "py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                        mode === 'content'
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                      )}
                    >
                      <LayoutList className="w-6 h-6" />
                      <span className="text-xs font-bold">AI 콘텐츠</span>
                    </button>
                    <button
                      onClick={() => { setMode('game'); setGameType('typing'); }}
                      className={cn(
                        "py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                        mode === 'game' && gameType === 'typing'
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                      )}
                    >
                      <Keyboard className="w-6 h-6" />
                      <span className="text-xs font-bold">타자 연습</span>
                    </button>
                    <button
                      onClick={() => { setMode('game'); setGameType('brick'); }}
                      className={cn(
                        "py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                        mode === 'game' && gameType === 'brick'
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                      )}
                    >
                      <Gamepad2 className="w-6 h-6" />
                      <span className="text-xs font-bold">벽돌 깨기</span>
                    </button>
                  </div>
                </div>

                {mode === 'content' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-500" />
                      오늘의 테마를 골라주세요
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat)}
                            className={cn(
                              "p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center",
                              selectedCategory.id === cat.id
                                ? "border-blue-600 bg-blue-50 shadow-sm"
                                : "border-slate-100 bg-white hover:border-slate-200"
                            )}
                          >
                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0", cat.color)}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className={cn(
                              "text-xs font-bold leading-tight",
                              selectedCategory.id === cat.id ? "text-blue-700" : "text-slate-600"
                            )}>
                              {cat.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                <div className="pt-4 space-y-3">
                  <button
                    onClick={startSession}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                  >
                    시작하기
                  </button>
                  <button
                    onClick={() => setStep('role')}
                    className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-all text-sm"
                  >
                    상황 다시 선택하기
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'content' && (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex-1 bg-slate-50 rounded-3xl p-6 relative overflow-y-auto max-h-[55vh] border border-slate-100 flex flex-col">
                  {mode === 'content' ? (
                    isLoading ? (
                      <div className="h-full flex-1 flex flex-col items-center justify-center space-y-4">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <RefreshCw className="w-10 h-10 text-blue-500" />
                        </motion.div>
                        <p className="text-slate-500 font-medium animate-pulse">
                          AI가 당신을 위한 콘텐츠를 작성 중입니다...
                        </p>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="prose prose-slate max-w-none"
                      >
                        {selectedCategory.id === 'nature' && content.startsWith('data:image') ? (
                          <div className="space-y-4">
                            <img 
                              src={content} 
                              alt="Nature Scenery" 
                              className="w-full rounded-2xl shadow-lg" 
                              referrerPolicy="no-referrer"
                            />
                            <p className="text-slate-600 text-center italic">
                              잠시 눈을 감고 대자연의 평온함을 느껴보세요. 당신의 휴식을 위해 생성된 특별한 풍경입니다.
                            </p>
                          </div>
                        ) : (
                          <ReactMarkdown>{content}</ReactMarkdown>
                        )}
                      </motion.div>
                    )
                  ) : (
                    gameType === 'brick' ? (
                      <BrickBreaker onFinish={handleFlush} />
                    ) : (
                      <TypingGame onFinish={handleFlush} />
                    )
                  )}
                </div>

                <div className="pt-6 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={resetSession}
                      className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all text-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      처음으로
                    </button>
                    <button
                      onClick={mode === 'content' ? generateContent : () => {}}
                      disabled={isLoading || mode === 'game'}
                      className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all disabled:opacity-50 text-sm"
                    >
                      <RefreshCw className={cn("w-4 h-4", (isLoading || mode === 'game') && "animate-spin")} />
                      {mode === 'content' ? '새로고침' : '게임 중'}
                    </button>
                  </div>
                  <button
                    onClick={handleFlush}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                  >
                    <Waves className="w-5 h-5" />
                    {userRole === 'pooper' ? '물 내리기 (종료)' : '기다림 끝 (종료)'}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'summary' && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
              >
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-slate-900">수고하셨습니다!</h2>
                  <p className="text-slate-500">오늘의 {userRole === 'pooper' ? '화장실 타임' : '대기 시간'} 요약</p>
                </div>

                <div className="w-full bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">{userRole === 'pooper' ? '소요 시간' : '기다린 시간'}</span>
                    <span className="text-xl font-bold text-blue-600 font-mono">{formatTime(finalTime)}</span>
                  </div>
                  <div className="h-px bg-slate-200 w-full" />
                  <div className="space-y-4">
                    <p className="text-sm font-bold text-slate-700">
                      {userRole === 'pooper' ? '오늘의 볼일은 어떠셨나요?' : '기다리는 시간은 어떠셨나요?'}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {(userRole === 'pooper' ? POOPER_RATINGS : WAITER_RATINGS).map((r) => (
                        <button
                          key={r.value}
                          onClick={() => setRating(r.value)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all",
                            rating === r.value
                              ? "border-blue-600 bg-blue-50"
                              : "border-transparent bg-white hover:border-slate-100"
                          )}
                        >
                          <span className="text-2xl">{r.emoji}</span>
                          <span className="text-[10px] font-bold text-slate-500 leading-tight">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={finishSession}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                >
                  완료
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer Decoration */}
        <footer className="p-6 text-center">
          <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">
            Enjoy your private time
          </p>
        </footer>

        {/* Background Elements */}
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50 -z-10" />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-slate-50 rounded-full blur-3xl opacity-50 -z-10" />
      </div>
    </div>
  );
}
