import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Play } from 'lucide-react';

interface BrickBreakerProps {
  onFinish: () => void;
}

type ItemType = 'wider_paddle' | 'extra_ball' | 'penetrating' | 'shield';

interface Item {
  x: number;
  y: number;
  type: ItemType;
  status: number;
}

interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  isPenetrating?: boolean;
}

export default function BrickBreaker({ onFinish }: BrickBreakerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'gameover' | 'win' | 'next_stage'>('ready');
  const [score, setScore] = useState(0);
  const [stage, setStage] = useState(1);
  const [lives, setLives] = useState(3);

  // Use refs to avoid stale closures in the game loop
  const livesRef = useRef(3);
  const scoreRef = useRef(0);

  const getBrickLayout = (currentStage: number) => {
    const layouts: { [key: number]: number[][] } = {
      1: [
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
      ],
      2: [
        [0, 1, 1, 1, 0],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [0, 1, 1, 1, 0],
        [0, 0, 1, 0, 0],
      ],
      3: [
        [1, 0, 1, 0, 1],
        [1, 1, 1, 1, 1],
        [1, 0, 1, 0, 1],
        [1, 1, 1, 1, 1],
        [1, 0, 1, 0, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
      ],
    };
    return layouts[currentStage] || layouts[1].map(row => row.map(() => (Math.random() > 0.3 ? 1 : 0)));
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Game constants
    const paddleHeight = 12;
    let currentPaddleWidth = Math.max(75 - (stage * 5), 50);
    let hasShield = false;
    
    const currentLayout = getBrickLayout(stage);
    const brickColumnCount = currentLayout.length;
    const brickRowCount = currentLayout[0].length;
    
    const brickPadding = 8;
    const brickOffsetTop = 40;
    const brickOffsetLeft = 15;
    const brickWidth = (canvas.width - (brickOffsetLeft * 2) - (brickPadding * (brickColumnCount - 1))) / brickColumnCount;
    const brickHeight = 18;

    // Ball speed increases with stage - Increased by 10% as requested
    const baseSpeed = (2.5 + (stage * 0.3)) * 1.1;
    
    let livesRef_local = lives;
    let scoreRef_local = score;
    livesRef.current = lives;
    scoreRef.current = score;
    
    // Time tracking for delta time
    let lastTime = performance.now();
    const targetFPS = 60;
    const targetFrameTime = 1000 / targetFPS; // ~16.67ms

    let balls: Ball[] = [{
      x: canvas.width / 2,
      y: canvas.height - 40,
      dx: baseSpeed * (Math.random() > 0.5 ? 1 : -1),
      dy: -baseSpeed,
      radius: 8
    }];

    let items: Item[] = [];
    
    let paddleX = (canvas.width - currentPaddleWidth) / 2;
    let rightPressed = false;
    let leftPressed = false;

    const bricks: { x: number; y: number; status: number }[][] = [];
    for (let c = 0; c < brickColumnCount; c++) {
      bricks[c] = [];
      for (let r = 0; r < brickRowCount; r++) {
        bricks[c][r] = { x: 0, y: 0, status: currentLayout[c][r] };
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
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const relativeX = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
      if (relativeX > 0 && relativeX < canvas.width) {
        paddleX = relativeX - currentPaddleWidth / 2;
      }
    };

    document.addEventListener("keydown", keyDownHandler, false);
    document.addEventListener("keyup", keyUpHandler, false);
    canvas.addEventListener("touchstart", touchHandler, { passive: false });
    canvas.addEventListener("touchmove", touchHandler, { passive: false });

    function collisionDetection() {
      for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
          const b = bricks[c][r];
          if (b.status === 1) {
            for (let i = 0; i < balls.length; i++) {
              const ball = balls[i];
              if (ball.x > b.x && ball.x < b.x + brickWidth && ball.y > b.y && ball.y < b.y + brickHeight) {
                if (ball.isPenetrating) {
                  // Don't flip dy if penetrating
                } else {
                  ball.dy = -ball.dy;
                }
                b.status = 0;
                scoreRef.current += 10;
                setScore(scoreRef.current);

                // Drop items with 33% probability
                if (Math.random() < 0.33) {
                  const types: ItemType[] = ['wider_paddle', 'extra_ball', 'penetrating', 'shield'];
                  items.push({
                    x: b.x + brickWidth / 2,
                    y: b.y + brickHeight / 2,
                    type: types[Math.floor(Math.random() * types.length)],
                    status: 1
                  });
                }
                
                // Check if all bricks are cleared
                let allCleared = true;
                for (let i = 0; i < brickColumnCount; i++) {
                  for (let j = 0; j < brickRowCount; j++) {
                    if (bricks[i][j].status === 1) {
                      allCleared = false;
                      break;
                    }
                  }
                  if (!allCleared) break;
                }
                
                if (allCleared) {
                  setGameState('next_stage');
                }
              }
            }
          }
        }
      }
    }

    function drawBalls() {
      if (!ctx) return;
      balls.forEach(ball => {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.isPenetrating ? "#ef4444" : "#3b82f6";
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = ball.isPenetrating ? "#ef4444" : "#3b82f6";
        ctx.closePath();
        ctx.shadowBlur = 0;
      });
    }

    function drawPaddle() {
      if (!ctx) return;
      ctx.beginPath();
      ctx.roundRect(paddleX, canvas!.height - paddleHeight - 15, currentPaddleWidth, paddleHeight, 5);
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
            ctx.roundRect(brickX, brickY, brickWidth, brickHeight, 3);
            ctx.fillStyle = `hsl(${(c * 40 + r * 20 + stage * 30) % 360}, 70%, 60%)`;
            ctx.fill();
            ctx.closePath();
          }
        }
      }
    }

    function drawItems() {
      if (!ctx) return;
      items.forEach(item => {
        if (item.status === 1) {
          ctx.beginPath();
          ctx.arc(item.x, item.y, 10, 0, Math.PI * 2);
          
          let color = "#000";
          let label = "";
          switch(item.type) {
            case 'wider_paddle': color = "#f59e0b"; label = "W"; break;
            case 'extra_ball': color = "#10b981"; label = "+"; break;
            case 'penetrating': color = "#ef4444"; label = "P"; break;
            case 'shield': color = "#ec4899"; label = "S"; break;
          }
          
          ctx.fillStyle = color;
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 10px Arial";
          ctx.textAlign = "center";
          ctx.fillText(label, item.x, item.y + 4);
          ctx.closePath();
        }
      });
    }

    function drawShield() {
      if (!ctx || !hasShield) return;
      ctx.beginPath();
      ctx.rect(0, canvas!.height - 5, canvas!.width, 5);
      ctx.fillStyle = "rgba(236, 72, 153, 0.5)";
      ctx.fill();
      ctx.closePath();
    }

    function drawHUD() {
      if (!ctx) return;
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "rgba(100, 116, 139, 0.6)";
      ctx.textAlign = "left";
      ctx.fillText(`Stage: ${stage}`, 15, 25);
      ctx.textAlign = "center";
      ctx.fillText(`Lives: ${livesRef.current}`, canvas!.width / 2, 25);
      ctx.textAlign = "right";
      ctx.fillText(`Score: ${scoreRef.current}`, canvas!.width - 15, 25);
    }

    function draw() {
      if (!ctx || !canvas || gameState !== 'playing') return;

      // Calculate Delta Time
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      // Speed multiplier based on 60FPS target
      const dtScale = deltaTime / targetFrameTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawHUD();
      drawBricks();
      drawBalls();
      drawPaddle();
      drawItems();
      drawShield();
      collisionDetection();

      // Move items
      items.forEach(item => {
        if (item.status === 1) {
          item.y += 2 * dtScale;
          // Paddle collision
          if (item.y + 10 > canvas.height - paddleHeight - 15 && 
              item.x > paddleX && item.x < paddleX + currentPaddleWidth) {
            item.status = 0;
            // Apply effect
            switch(item.type) {
              case 'wider_paddle':
                currentPaddleWidth = Math.min(currentPaddleWidth + 30, 150);
                break;
              case 'extra_ball':
                balls.push({
                  x: paddleX + currentPaddleWidth / 2,
                  y: canvas.height - 40,
                  dx: baseSpeed * (Math.random() > 0.5 ? 1 : -1),
                  dy: -baseSpeed,
                  radius: 8
                });
                break;
              case 'penetrating':
                balls.forEach(b => b.isPenetrating = true);
                break;
              case 'shield':
                hasShield = true;
                break;
            }
          }
          if (item.y > canvas.height) item.status = 0;
        }
      });

      // Move balls
      for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        
        // Next position based on delta time
        const nextX = ball.x + (ball.dx * dtScale);
        const nextY = ball.y + (ball.dy * dtScale);

        if (nextX > canvas.width - ball.radius || nextX < ball.radius) {
          ball.dx = -ball.dx;
        }
        if (nextY < ball.radius) {
          ball.dy = -ball.dy;
        } else if (nextY > canvas.height - ball.radius - 15) {
          if (ball.x > paddleX && ball.x < paddleX + currentPaddleWidth) {
            const hitPos = (ball.x - (paddleX + currentPaddleWidth / 2)) / (currentPaddleWidth / 2);
            ball.dx = baseSpeed * hitPos * 1.5;
            ball.dy = -Math.abs(ball.dy); // Ensure it goes up
            ball.isPenetrating = false; // Reset penetrating on paddle hit
          } else if (nextY > canvas.height - ball.radius) {
            if (hasShield) {
              hasShield = false;
              ball.dy = -Math.abs(ball.dy);
            } else {
              balls.splice(i, 1);
              if (balls.length === 0) {
                if (livesRef.current > 1) {
                  livesRef.current--;
                  setLives(livesRef.current);
                  balls.push({
                    x: paddleX + currentPaddleWidth / 2,
                    y: canvas.height - 40,
                    dx: baseSpeed * (Math.random() > 0.5 ? 1 : -1),
                    dy: -baseSpeed,
                    radius: 8
                  });
                } else {
                  livesRef.current = 0;
                  setLives(0);
                  setGameState('gameover');
                  return;
                }
              }
            }
          }
        }
        ball.x += ball.dx * dtScale;
        ball.y += ball.dy * dtScale;
      }

      if (rightPressed && paddleX < canvas.width - currentPaddleWidth) {
        paddleX += 8 * dtScale;
      } else if (leftPressed && paddleX > 0) {
        paddleX -= 8 * dtScale;
      }

      requestAnimationFrame(draw);
    }

    const animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener("keydown", keyDownHandler);
      document.removeEventListener("keyup", keyUpHandler);
      canvas.removeEventListener("touchstart", touchHandler);
      canvas.removeEventListener("touchmove", touchHandler);
    };
  }, [gameState, stage]);

  return (
    <div className="flex flex-col items-center space-y-3 w-full">
      <div className="relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 w-full aspect-[4/4.5] max-w-[400px]">
        <canvas
          ref={canvasRef}
          width={400}
          height={450}
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
            {gameState === 'next_stage' && (
              <>
                <h4 className="text-2xl font-bold text-green-600 mb-2">Stage {stage} Clear!</h4>
                <p className="text-slate-500 text-sm mb-6">다음 스테이지로 넘어갑니다.</p>
                <button
                  onClick={() => {
                    setStage(s => s + 1);
                    setGameState('playing');
                  }}
                  className="px-8 py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all"
                >
                  다음 스테이지
                </button>
              </>
            )}
            {gameState === 'gameover' && (
              <h4 className="text-2xl font-bold text-red-500 mb-4">Game Over!</h4>
            )}
            {(gameState === 'gameover' || gameState === 'win') && (
              <>
                <h4 className="text-2xl font-bold text-slate-800 mb-4">
                  {gameState === 'gameover' ? '아쉬워요!' : '대단해요!'}
                </h4>
                <p className="text-slate-500 mb-6">최종 점수: {score}</p>
                <button
                  onClick={() => {
                    setScore(0);
                    setStage(1);
                    setLives(3);
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
      
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 w-full space-y-2">
        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          화면을 터치하여 패들을 조작하세요.<br/>
          스테이지가 올라갈수록 공이 빨라지고 패들이 작아집니다!
        </p>
        <div className="flex justify-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#f59e0b] flex items-center justify-center text-[6px] text-white font-bold">W</div>
            <span className="text-[8px] text-slate-500">패들 확장</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#10b981] flex items-center justify-center text-[6px] text-white font-bold">+</div>
            <span className="text-[8px] text-slate-500">공 추가</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#ef4444] flex items-center justify-center text-[6px] text-white font-bold">P</div>
            <span className="text-[8px] text-slate-500">관통공</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#ec4899] flex items-center justify-center text-[6px] text-white font-bold">S</div>
            <span className="text-[8px] text-slate-500">바닥 보호</span>
          </div>
        </div>
      </div>
    </div>
  );
}
