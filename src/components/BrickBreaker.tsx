import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Play } from 'lucide-react';

interface BrickBreakerProps {
  onFinish: () => void;
}

export default function BrickBreaker({ onFinish }: BrickBreakerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'gameover' | 'win'>('ready');
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Game constants
    const ballRadius = 8;
    const paddleHeight = 10;
    const paddleWidth = 75;
    const brickRowCount = 5;
    const brickColumnCount = 4;
    const brickWidth = (canvas.width - 40) / brickColumnCount;
    const brickHeight = 20;
    const brickPadding = 10;
    const brickOffsetTop = 30;
    const brickOffsetLeft = 20;

    let x = canvas.width / 2;
    let y = canvas.height - 30;
    let dx = 2;
    let dy = -2;
    let paddleX = (canvas.width - paddleWidth) / 2;
    let rightPressed = false;
    let leftPressed = false;

    const bricks: { x: number; y: number; status: number }[][] = [];
    for (let c = 0; c < brickColumnCount; c++) {
      bricks[c] = [];
      for (let r = 0; r < brickRowCount; r++) {
        bricks[c][r] = { x: 0, y: 0, status: 1 };
      }
    }

    const keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === "Right" || e.key === "ArrowRight") rightPressed = true;
      else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed = true;
    };

    const keyUpHandler = (e: KeyboardEvent) => {
      if (e.key === "Right" || e.key === "ArrowRight") rightPressed = false;
      else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed = false;
    };

    const touchHandler = (e: TouchEvent) => {
      const relativeX = e.touches[0].clientX - canvas.offsetLeft;
      if (relativeX > 0 && relativeX < canvas.width) {
        paddleX = relativeX - paddleWidth / 2;
      }
    };

    document.addEventListener("keydown", keyDownHandler, false);
    document.addEventListener("keyup", keyUpHandler, false);
    canvas.addEventListener("touchmove", touchHandler, { passive: false });

    function collisionDetection() {
      for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
          const b = bricks[c][r];
          if (b.status === 1) {
            if (x > b.x && x < b.x + brickWidth && y > b.y && y < b.y + brickHeight) {
              dy = -dy;
              b.status = 0;
              setScore((s) => s + 1);
              if (bricks.every(col => col.every(brick => brick.status === 0))) {
                setGameState('win');
              }
            }
          }
        }
      }
    }

    function drawBall() {
      if (!ctx) return;
      ctx.beginPath();
      ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f6";
      ctx.fill();
      ctx.closePath();
    }

    function drawPaddle() {
      if (!ctx) return;
      ctx.beginPath();
      ctx.rect(paddleX, canvas!.height - paddleHeight - 5, paddleWidth, paddleHeight);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.closePath();
    }

    function drawBricks() {
      if (!ctx) return;
      for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
          if (bricks[c][r].status === 1) {
            const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
            const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
            bricks[c][r].x = brickX;
            bricks[c][r].y = brickY;
            ctx.beginPath();
            ctx.rect(brickX, brickY, brickWidth, brickHeight);
            ctx.fillStyle = `hsl(${c * 60 + 200}, 70%, 60%)`;
            ctx.fill();
            ctx.closePath();
          }
        }
      }
    }

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBricks();
      drawBall();
      drawPaddle();
      collisionDetection();

      if (x + dx > canvas.width - ballRadius || x + dx < ballRadius) {
        dx = -dx;
      }
      if (y + dy < ballRadius) {
        dy = -dy;
      } else if (y + dy > canvas.height - ballRadius - 5) {
        if (x > paddleX && x < paddleX + paddleWidth) {
          dy = -dy;
        } else {
          setGameState('gameover');
          return;
        }
      }

      if (rightPressed && paddleX < canvas.width - paddleWidth) {
        paddleX += 7;
      } else if (leftPressed && paddleX > 0) {
        paddleX -= 7;
      }

      x += dx;
      y += dy;
      requestAnimationFrame(draw);
    }

    const animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener("keydown", keyDownHandler);
      document.removeEventListener("keyup", keyUpHandler);
      canvas.removeEventListener("touchmove", touchHandler);
    };
  }, [gameState]);

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      <div className="flex justify-between w-full px-2 text-sm font-bold text-slate-500">
        <span>Score: {score}</span>
        {gameState === 'gameover' && <span className="text-red-500">Game Over!</span>}
        {gameState === 'win' && <span className="text-green-500">You Win!</span>}
      </div>
      
      <div className="relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 w-full aspect-[4/5]">
        <canvas
          ref={canvasRef}
          width={320}
          height={400}
          className="w-full h-full touch-none"
        />
        
        {gameState !== 'playing' && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            {gameState === 'ready' && (
              <>
                <h4 className="text-xl font-bold text-slate-800 mb-2">벽돌 깨기</h4>
                <p className="text-slate-500 text-sm mb-6">공을 튕겨서 모든 벽돌을 제거하세요!</p>
                <button
                  onClick={() => setGameState('playing')}
                  className="p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all"
                >
                  <Play className="w-8 h-8 fill-current" />
                </button>
              </>
            )}
            {(gameState === 'gameover' || gameState === 'win') && (
              <>
                <h4 className="text-2xl font-bold text-slate-800 mb-4">
                  {gameState === 'gameover' ? '아쉬워요!' : '대단해요!'}
                </h4>
                <button
                  onClick={() => {
                    setScore(0);
                    setGameState('playing');
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                  다시 시작
                </button>
              </>
            )}
          </div>
        )}
      </div>
      
      <p className="text-[10px] text-slate-400 text-center">
        화면을 터치하거나 화살표 키로 패들을 움직이세요.
      </p>
    </div>
  );
}
