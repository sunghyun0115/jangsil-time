import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Keyboard, Trophy, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TypingGameProps {
  onFinish: () => void;
}

const WORDS = [
  '사과', '바나나', '포도', '수박', '오렌지', '딸기', '망고', '키위', '복숭아', '체리',
  '강아지', '고양이', '토끼', '사자', '호랑이', '코끼리', '기린', '얼룩말', '판다', '펭귄',
  '바다', '산', '강', '하늘', '구름', '태양', '달', '별', '바람', '비',
  '컴퓨터', '핸드폰', '마우스', '키보드', '모니터', '노트북', '인터넷', '코딩', '프로그램', '데이터',
  '학교', '회사', '집', '공원', '도서관', '병원', '은행', '식당', '카페', '영화관',
  '사랑', '행복', '기쁨', '슬픔', '화남', '즐거움', '평화', '희망', '용기', '지혜',
  '피자', '치킨', '햄버거', '파스타', '떡볶이', '김밥', '라면', '우동', '초밥', '만두',
  '축구', '농구', '야구', '배구', '테니스', '골프', '수영', '달리기', '등산', '낚시',
  '빨강', '파랑', '노랑', '초록', '보라', '주황', '검정', '하얀', '분홍', '회색',
  '단풍', '숲길', '파도', '벌판', '들판', '안개', '이슬', '서리', '번개', '천둥', '노을', '새벽',
  '시계', '거울', '안경', '가방', '지갑', '우산', '사전', '일기', '사진', '편지', '선물', '상자',
  '걷기', '뛰기', '웃기', '노래', '춤추기', '수다', '공부', '구경', '산책', '여행', '쇼핑', '요리',
  '된장국', '비빔밥', '냉면', '불고기', '갈비', '잡채', '미역국', '삼계탕', '보쌈', '족발',
  '추억', '비밀', '인연', '우정', '축제', '감동', '기적', '열정', '자유', '정의', '행운', '성공',
  '풍경', '전설', '영웅', '모험', '지구', '우주', '미래', '과거', '현재', '지식', '예능', '드라마'
];

const HARD_WORDS = [
  '읊다', '밟다', '핥다', '훑다', '뚫다', '끓다', '닻', '돛', '숯', '옻',
  '낚시', '깎다', '섞다', '묶다', '닦다', '넋', '삯', '몫', '흙', '닭',
  '삶', '젊다', '닮다', '굶다', '옮다', '읊조리다', '흙먼지', '닭싸움', '삶의지혜', '젊은이',
  '닮은꼴', '굶주림', '옮기다', '여덟', '넓다', '떫다', '옭다', '갉다', '맑다', '묽다',
  '깎듯이', '엮다', '꺾다', '깎아지른', '겯다', '굳다', '쏟다', '뻗다', '뼛속', '닻줄', '돛배',
  '꽃밭', '빛깔', '낯설다', '낯가림', '끝장', '곁가지', '낱알', '밭둑', '잎사귀', '무릎', '갚다',
  '밑동', '끝동', '겉모양', '꽃망울', '홑몸', '풀섶', '늪지대', '숲속', '무릎베개', '낱낱이', '밭고랑'
];

export default function TypingGame({ onFinish }: TypingGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [currentWord, setCurrentWord] = useState('');
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [wpm, setWpm] = useState(0);
  const [isHard, setIsHard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getNewWord = useCallback(() => {
    // 20% chance to get a hard word
    const isHardWord = Math.random() < 0.2;
    setIsHard(isHardWord);
    const list = isHardWord ? HARD_WORDS : WORDS;
    
    let nextWord = currentWord;
    // Ensure the new word is different from the current one
    while (nextWord === currentWord) {
      const randomIndex = Math.floor(Math.random() * list.length);
      nextWord = list[randomIndex];
    }
    
    setCurrentWord(nextWord);
  }, [currentWord]);

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
    setUserInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If the game is active and the user presses Enter or Space
    if (e.key === ' ' || e.key === 'Enter') {
      // Check if the input (trimmed) matches the word
      if (userInput.trim() === currentWord) {
        e.preventDefault(); // Prevent adding the space/newline to the input
        setScore((prev) => prev + 1);
        setUserInput('');
        getNewWord();
        // Clear the actual DOM element immediately
        (e.target as HTMLInputElement).value = '';
      }
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
              <div className="flex items-center justify-center gap-2">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">다음 단어</p>
                {isHard && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full animate-pulse">
                    HARD
                  </span>
                )}
              </div>
              <h5 className={cn(
                "text-4xl font-black tracking-tight transition-all",
                isHard ? "text-red-600 scale-110" : "text-slate-800"
              )}>
                {currentWord}
              </h5>
            </div>
            
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="여기에 입력하세요"
              className="w-full p-4 bg-white border-2 border-blue-200 rounded-2xl text-center text-xl font-bold focus:outline-none focus:border-blue-500 transition-all shadow-sm"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
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
        단어를 입력하고 <span className="font-bold text-blue-500">스페이스바</span> 또는 <span className="font-bold text-blue-500">엔터</span>를 치면<br />정답 처리가 되며 다음 단어로 넘어갑니다.
      </p>
    </div>
  );
}
