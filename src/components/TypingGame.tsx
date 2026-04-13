import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Keyboard, Trophy, Timer } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface TypingGameProps {
  onFinish: () => void;
}

const WORDS = [
  '사과', '바나나', '포도', '수박', '오렌지', '딸기', '망고', '키위', '복숭아', '체리',
  '강아지', '고양이', '토끼', '사자', '호랑이', '코끼리', '기린', '얼룩말', '판다', '펭귄',
  '바다', '산', '강', '하늘', '구름', '태양', '달', '별', '바람', '비',
  '컴퓨터', '핸드폰', '마우스', '키보드', '모니터', '노트북', '인터넷', '코딩', '프로그램', '데이터',
  '학교', '회사', '집', '공원', '도서관', '병원', '은행', '식당', '카페', '영화관',
  '사랑', '행복', '기쁨', '슬픔', '화남', '즐거움', '평화', '희망', '용기', '지혜'
];

export default function TypingGame({ onFinish }: TypingGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [currentWord, setCurrentWord] = useState('');
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [wpm, setWpm] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const getNewWord = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * WORDS.length);
    setCurrentWord(WORDS[randomIndex]);
  }, []);

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setTimeLeft(30);
    setUserInput('');
    getNewWord();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setGameState('finished');
      setWpm(Math.round((score / 30) * 60));
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, score]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserInput(value);

    if (value.trim() === currentWord) {
      setScore((prev) => prev + 1);
      setUserInput('');
      getNewWord();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6 w-full p-4">
      <div className="flex justify-between w-full px-2 text-sm font-bold text-slate-500">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span>점수: {score}</span>
        </div>
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-blue-500" />
          <span>시간: {timeLeft}s</span>
        </div>
      </div>

      <div className="relative bg-slate-50 rounded-3xl p-8 border-2 border-slate-100 w-full flex flex-col items-center justify-center min-h-[250px] shadow-inner">
        {gameState === 'ready' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mx-auto">
              <Keyboard className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-slate-800">타자 연습</h4>
            <p className="text-slate-500 text-sm">30초 동안 얼마나 많은 단어를<br />정확하게 칠 수 있을까요?</p>
            <button
              onClick={startGame}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95"
            >
              시작하기
            </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="w-full space-y-8 text-center">
            <div className="space-y-2">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">다음 단어</p>
              <h5 className="text-4xl font-black text-slate-800 tracking-tight">{currentWord}</h5>
            </div>
            
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={handleInputChange}
              placeholder="여기에 입력하세요"
              className="w-full p-4 bg-white border-2 border-blue-200 rounded-2xl text-center text-xl font-bold focus:outline-none focus:border-blue-500 transition-all shadow-sm"
              autoFocus
            />
          </div>
        )}

        {gameState === 'finished' && (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h4 className="text-2xl font-bold text-slate-800">결과</h4>
              <div className="flex items-center justify-center gap-4">
                <div className="bg-blue-50 px-4 py-2 rounded-xl">
                  <p className="text-[10px] text-blue-500 font-bold uppercase">정확도</p>
                  <p className="text-2xl font-black text-blue-700">{score}개</p>
                </div>
                <div className="bg-purple-50 px-4 py-2 rounded-xl">
                  <p className="text-[10px] text-purple-500 font-bold uppercase">WPM</p>
                  <p className="text-2xl font-black text-purple-700">{wpm}</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={startGame}
                className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95"
              >
                <RefreshCw className="w-5 h-5" />
                다시 하기
              </button>
              <button
                onClick={onFinish}
                className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                그만하기
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
        단어를 입력하고 공백 없이 정확하게 치면<br />다음 단어로 넘어갑니다.
      </p>
    </div>
  );
}
