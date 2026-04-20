import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Play } from 'lucide-react';

interface BrickBreakerProps {
  onFinish: () => void;
}

type ItemType = 'wider_paddle' | 'extra_ball' | 'penetrating' | 'shield' | 'shorter_paddle' | 'add_bricks' | 'inverted_controls' | 'fast_ball';

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
    const layoutIndex = ((currentStage - 1) % 5) + 1;
    const layouts: { [key: number]: number[][] } = {
      1: [ // Classic Grid
        [1, 1, 1, 1, 1],
        [1, 2, 1, 2, 1],
        [1, 1, 1, 1, 1],
        [1, 2, 1, 2, 1],
        [1, 1, 1, 1, 1],
      ],
      2: [ // Diamond
        [0, 0, 2, 0, 0],
        [0, 2, 1, 2, 0],
        [2, 1, 1, 1, 2],
        [0, 2, 1, 2, 0],
        [0, 0, 2, 0, 0],
      ],
      3: [ // Columns
        [1, 2, 0, 2, 1],
        [1, 2, 0, 2, 1],
        [1, 2, 0, 2, 1],
        [1, 2, 0, 2, 1],
        [1, 2, 0, 2, 1],
      ],
      4: [ // Pyramid
        [0, 0, 1, 0, 0],
        [0, 1, 2, 1, 0],
        [1, 2, 2, 2, 1],
        [2, 1, 1, 1, 2],
        [1, 1, 1, 1, 1],
      ],
      5: [ // Cross / Heart-ish
        [1, 0, 0, 0, 1],
        [1, 1, 0, 1, 1],
        [0, 2, 2, 2, 0],
        [0, 1, 2, 1, 0],
        [0, 0, 1, 0, 0],
      ],
    };
    
    const baseLayout = layouts[layoutIndex];
    
    // For stage 5+, upgrade some status 2 bricks to status 3
    if (currentStage >= 5) {
      return baseLayout.map(row => 
        row.map(cell => (cell === 2 && Math.random() < 0.3) ? 3 : cell)
      );
    }
    
    return baseLayout;
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Game constants
    const paddleHeight = 12;
    let currentPaddleWidth = 80;
    let hasShield = false;
    let isInverted = false;
    let inversionTimer = 0;
    
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

    let comboCount = 0;
    let lastBonusScore = 0;
    const bonusThreshold = 1000;
    
    let isFeverMode = false;
    let feverTimer = 0;
    let feverLastBallSpawnTime = 0;
    let feverLastBrickSpawnTime = 0;
    const feverDuration = 7000;
    const feverComboThreshold = 15;
    let preFeverBricks: number[][] = [];
    let preFeverBalls: Ball[] = [];
    let preFeverPaddleWidth = 80;
    let preFeverHasShield = false;
    let preFeverIsInverted = false;
    let preFeverInversionTimer = 0;

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

    const bricks: { x: number; y: number; status: number; respawnTimer: number }[][] = [];
    for (let c = 0; c < brickColumnCount; c++) {
      bricks[c] = [];
      for (let r = 0; r < brickRowCount; r++) {
        bricks[c][r] = { x: 0, y: 0, status: currentLayout[c][r], respawnTimer: 0 };
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

    function ballsCollisionDetection() {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i];
          const b2 = balls[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = b1.radius + b2.radius;

          if (distance < minDistance) {
            // Collision detected! Use elastic collision physics
            // 1. Calculate collision normal
            const nx = dx / distance;
            const ny = dy / distance;

            // 2. Relative velocity
            const rvx = b2.dx - b1.dx;
            const rvy = b2.dy - b1.dy;

            // 3. Velocity along the normal
            const velAlongNormal = rvx * nx + rvy * ny;

            // Do not resolve if velocities are separating
            if (velAlongNormal > 0) continue;

            // 4. Impulse scalar (assuming equal mass)
            const impulse = velAlongNormal;

            // 5. Apply impulse
            b1.dx += impulse * nx;
            b1.dy += impulse * ny;
            b2.dx -= impulse * nx;
            b2.dy -= impulse * ny;

            // 6. Fix overlap (positional correction to prevent sticking)
            const overlap = minDistance - distance;
            const percent = 0.5; // push each ball back by half the overlap
            const slop = 0.01;
            const correction = Math.max(overlap - slop, 0) / 2 * percent;
            const cx = nx * correction;
            const cy = ny * correction;
            b1.x -= cx;
            b1.y -= cy;
            b2.x += cx;
            b2.y += cy;
          }
        }
      }
    }

    function collisionDetection() {
      let cleared = false;
      for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
          const b = bricks[c][r];
          if (b.status > 0) {
            for (let i = 0; i < balls.length; i++) {
              const ball = balls[i];
              if (ball.x > b.x && ball.x < b.x + brickWidth && ball.y > b.y && ball.y < b.y + brickHeight) {
                // Ball should bounce on durable bricks (status 2 or 3) even if penetrating
                // to prevent it from destroying them in a single pass.
                const shouldBounce = !ball.isPenetrating || b.status >= 2;
                if (shouldBounce) {
                  ball.dy = -ball.dy;
                }
                
                b.status--;
                
                // Combo logic
                comboCount++;
                const comboBonus = Math.max(1, Math.floor(comboCount / 3));

                // Overall drop probability remains 33% per hit
                if (Math.random() < 0.33) {
                  // Within the drop, 20% chance it's a trap, 80% chance it's a perk
                  const isTrap = Math.random() < 0.20;
                  let selectedType: ItemType;
                  
                  if (isTrap) {
                    const traps: ItemType[] = ['shorter_paddle', 'add_bricks', 'inverted_controls', 'fast_ball'];
                    selectedType = traps[Math.floor(Math.random() * traps.length)];
                  } else {
                    const perks: ItemType[] = ['wider_paddle', 'extra_ball', 'penetrating', 'shield'];
                    selectedType = perks[Math.floor(Math.random() * perks.length)];
                  }

                  items.push({
                    x: b.x + brickWidth / 2,
                    y: b.y + brickHeight / 2,
                    type: selectedType,
                    status: 1
                  });
                }

                if (b.status === 0) {
                  const basePoints = 10;
                  const pointsMultiplier = isFeverMode ? 2 : 1;
                  const finalPoints = basePoints * comboBonus * pointsMultiplier;
                  scoreRef.current += finalPoints;
                  setScore(scoreRef.current);
                  
                  // Fever Mode individual brick regeneration (0.5s delay)
                  if (isFeverMode && Math.random() < 0.7) {
                    b.respawnTimer = 500;
                  }
                } else {
                  const pointsMultiplier = isFeverMode ? 2 : 1;
                  const hitPoints = 2 * comboBonus * pointsMultiplier;
                  scoreRef.current += hitPoints;
                  setScore(scoreRef.current);
                }
                
                // Fever Mode Trigger (Based on 10 Combo)
                if (!isFeverMode && comboCount >= feverComboThreshold) {
                  isFeverMode = true;
                  feverTimer = feverDuration;
                  feverLastBallSpawnTime = performance.now();
                  feverLastBrickSpawnTime = performance.now();
                  comboCount = 0; // Reset combo for next fever cycle

                  // Save current state for restoration
                  preFeverBricks = bricks.map(col => col.map(b => b.status));
                  preFeverBalls = balls.map(b => ({ ...b }));
                  preFeverPaddleWidth = currentPaddleWidth;
                  preFeverHasShield = hasShield;
                  preFeverIsInverted = isInverted;
                  preFeverInversionTimer = inversionTimer;

                  // Apply hyper speed to existing balls
                  balls.forEach(ball => {
                    ball.dx *= 1.75;
                    ball.dy *= 1.75;
                  });
                }
                
                // Milestone Bonus Check
                if (Math.floor(scoreRef.current / bonusThreshold) > Math.floor(lastBonusScore / bonusThreshold)) {
                  lastBonusScore = scoreRef.current;
                  const perks: ItemType[] = ['wider_paddle', 'extra_ball', 'penetrating', 'shield'];
                  items.push({
                    x: b.x + brickWidth / 2,
                    y: b.y + brickHeight / 2,
                    type: perks[Math.floor(Math.random() * perks.length)],
                    status: 1
                  });
                }
                
                // Check if all bricks are cleared
                let allCleared = true;
                for (let bc = 0; bc < brickColumnCount; bc++) {
                  for (let br = 0; br < brickRowCount; br++) {
                    if (bricks[bc][br].status > 0) {
                      allCleared = false;
                      break;
                    }
                  }
                  if (!allCleared) break;
                }
                
                if (allCleared) {
                  if (isFeverMode) {
                    // Fallback regeneration if all bricks cleared during Fever
                    for (let bc = 0; bc < brickColumnCount; bc++) {
                      for (let br = 0; br < brickRowCount; br++) {
                        if (currentLayout[bc][br] > 0) {
                          bricks[bc][br].status = 1;
                        }
                      }
                    }
                  } else {
                    cleared = true;
                    setGameState('next_stage');
                    return true;
                  }
                }

                // If the ball bounced, we stop checking this ball for other bricks this frame
                if (shouldBounce) break;
              }
            }
          }
        }
      }
      return cleared;
    }

    function drawBalls() {
      if (!ctx) return;
      balls.forEach(ball => {
        // Draw Ball
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.isPenetrating ? "#ef4444" : "#3b82f6";
        ctx.fill();
        ctx.shadowBlur = ball.isPenetrating ? 15 : 10;
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
          if (bricks[c][r].status > 0) {
            const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
            const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
            bricks[c][r].x = brickX;
            bricks[c][r].y = brickY;
            
            ctx.beginPath();
            ctx.roundRect(brickX, brickY, brickWidth, brickHeight, 3);
            
            const hue = (c * 40 + r * 20 + stage * 30) % 360;
            if (bricks[c][r].status === 3) {
              // Extra Hard brick (3 hits): Very dark with thick border
              ctx.fillStyle = `hsl(${hue}, 80%, 20%)`;
              ctx.fill();
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 2;
              ctx.stroke();
            } else if (bricks[c][r].status === 2) {
              // Hard brick (2 hits): Darker and has a border
              ctx.fillStyle = `hsl(${hue}, 70%, 35%)`;
              ctx.fill();
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 1;
              ctx.stroke();
            } else {
              ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
              ctx.fill();
            }
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
          let isTrap = false;

          switch(item.type) {
            case 'wider_paddle': color = "#f59e0b"; label = "W"; break;
            case 'shorter_paddle': color = "#475569"; label = "S"; isTrap = true; break;
            case 'extra_ball': color = "#10b981"; label = "+"; break;
            case 'penetrating': color = "#ef4444"; label = "P"; break;
            case 'shield': color = "#ec4899"; label = "B"; break;
            case 'add_bricks': color = "#9333ea"; label = "A"; isTrap = true; break;
            case 'inverted_controls': color = "#1e293b"; label = "I"; isTrap = true; break;
            case 'fast_ball': color = "#7c2d12"; label = "F"; isTrap = true; break;
          }
          
          ctx.fillStyle = color;
          ctx.fill();

          if (isTrap) {
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
          }

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
      
      if (comboCount > 1) {
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(59, 130, 246, 0.4)";
        ctx.font = "bold 16px Arial";
        ctx.fillText(`${comboCount} COMBO!`, canvas!.width / 2, canvas!.height - 5);
      }

      if (isInverted) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#475569";
        ctx.font = "bold 12px Arial";
        ctx.fillText("조작 반전 시전 중!", canvas!.width / 2, canvas!.height - 40);
      }

      if (isFeverMode) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 20px Arial";
        ctx.fillText("🔥 FEVER MODE 🔥", canvas!.width / 2, canvas!.height / 2 + 50);
        ctx.font = "bold 12px Arial";
        ctx.fillText(`${(feverTimer / 1000).toFixed(1)}s`, canvas!.width / 2, canvas!.height / 2 + 70);
      }
    }

    function draw() {
      if (!ctx || !canvas || gameState !== 'playing') return;

      // Calculate Delta Time
      const currentTime = performance.now();
      let deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      // Cap delta time to prevent massive jumps when tab is backgrounded
      if (deltaTime > 100) deltaTime = 16.67;

      // Speed multiplier based on 60FPS target
      const dtScale = deltaTime / targetFrameTime;

      // Handle timers
      if (inversionTimer > 0) {
        inversionTimer -= deltaTime;
        if (inversionTimer <= 0) {
          isInverted = false;
        }
      }
      
      // Handle Fever Timer
      if (isFeverMode) {
        feverTimer -= deltaTime;
        
        // Spawn fireball every 0.5 seconds
        if (currentTime - feverLastBallSpawnTime >= 500) {
          feverLastBallSpawnTime = currentTime;
          balls.push({
            x: paddleX + currentPaddleWidth / 2,
            y: canvas.height - 40,
            dx: baseSpeed * 1.75 * (Math.random() > 0.5 ? 1 : -1),
            dy: -baseSpeed * 1.75,
            radius: 8
          });
        }

        // Randomly spawn bricks in empty spots every 0.3 seconds during Fever
        if (currentTime - feverLastBrickSpawnTime >= 300) {
          feverLastBrickSpawnTime = currentTime;
          for (let i = 0; i < 5; i++) {
            const rc = Math.floor(Math.random() * brickColumnCount);
            const rr = Math.floor(Math.random() * brickRowCount);
            const b = bricks[rc][rr];
            if (b.status === 0 && b.respawnTimer <= 0) {
              b.respawnTimer = 500; // 0.5s delay for random spawns too
            }
          }
        }

        if (feverTimer <= 0) {
          isFeverMode = false;
          // Restore saved state
          for (let c = 0; c < brickColumnCount; c++) {
            for (let r = 0; r < brickRowCount; r++) {
              bricks[c][r].status = preFeverBricks[c][r];
              bricks[c][r].respawnTimer = 0; // Clear any pending respawns
            }
          }
          balls = preFeverBalls.map(b => ({ ...b }));
          currentPaddleWidth = preFeverPaddleWidth;
          hasShield = preFeverHasShield;
          isInverted = preFeverIsInverted;
          inversionTimer = preFeverInversionTimer;
          
          return;
        }
      }

      // Handle Brick Respawn Timers
      for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
          const b = bricks[c][r];
          if (b.respawnTimer > 0) {
            b.respawnTimer -= deltaTime;
            if (b.respawnTimer <= 0) {
              b.status = 1;
              b.respawnTimer = 0;
            }
          }
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (isFeverMode) {
        ctx.fillStyle = "rgba(254, 243, 199, 0.3)"; // Warm golden glow
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      drawHUD();
      drawBricks();
      drawBalls();
      drawItems();
      drawPaddle();
      drawShield();
      
      // Handle ball-to-ball collisions (Disabled in Fever Mode)
      if (!isFeverMode) {
        ballsCollisionDetection();
      }
      
      // If stage cleared in this frame, stop processing movement and physics
      if (collisionDetection()) return;

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
                currentPaddleWidth = Math.min(currentPaddleWidth + 30, 200);
                break;
              case 'shorter_paddle':
                currentPaddleWidth = Math.max(currentPaddleWidth - 30, 40);
                break;
              case 'add_bricks': {
                // Find empty spots to regenerate bricks (max 3)
                let added = 0;
                for (let attempt = 0; attempt < 15 && added < 3; attempt++) {
                  const rc = Math.floor(Math.random() * brickColumnCount);
                  const rr = Math.floor(Math.random() * brickRowCount);
                  if (bricks[rc][rr].status === 0) {
                    bricks[rc][rr].status = 1;
                    added++;
                  }
                }
                break;
              }
              case 'inverted_controls':
                isInverted = true;
                inversionTimer = 5000; // 5 seconds
                break;
              case 'fast_ball':
                balls.forEach(b => {
                  b.dx *= 1.3;
                  b.dy *= 1.3;
                });
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
            // comboCount no longer resets on paddle hit per user request
          } else if (nextY > canvas.height - ball.radius) {
            if (isFeverMode) {
              // Invincible floor in Fever Mode
              ball.dy = -Math.abs(ball.dy);
            } else if (hasShield) {
              hasShield = false;
              ball.dy = -Math.abs(ball.dy);
            } else {
              balls.splice(i, 1);
              if (balls.length === 0) {
                comboCount = 0; // Reset combo on life loss
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

      if (rightPressed) {
        if (isInverted) {
          if (paddleX > 0) paddleX -= 8 * dtScale;
        } else {
          if (paddleX < canvas.width - currentPaddleWidth) paddleX += 8 * dtScale;
        }
      } else if (leftPressed) {
        if (isInverted) {
          if (paddleX < canvas.width - currentPaddleWidth) paddleX += 8 * dtScale;
        } else {
          if (paddleX > 0) paddleX -= 8 * dtScale;
        }
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
          스테이지가 올라갈수록 공의 속도가 빨라집니다!
        </p>
        <div className="grid grid-cols-4 gap-y-2 gap-x-3 justify-items-center">
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
            <div className="w-3 h-3 rounded-full bg-[#ec4899] flex items-center justify-center text-[6px] text-white font-bold">B</div>
            <span className="text-[8px] text-slate-500">바닥 보호</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#1e293b] border border-dashed border-slate-400 flex items-center justify-center text-[6px] text-white font-bold">I</div>
            <span className="text-[8px] text-slate-500 font-bold text-slate-600">조작 반전</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#7c2d12] border border-dashed border-slate-400 flex items-center justify-center text-[6px] text-white font-bold">F</div>
            <span className="text-[8px] text-slate-500 font-bold text-slate-600">공 속도 증가</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#475569] border border-dashed border-slate-400 flex items-center justify-center text-[6px] text-white font-bold">S</div>
            <span className="text-[8px] text-slate-500 font-bold text-slate-600">패들 축소</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#9333ea] border border-dashed border-slate-400 flex items-center justify-center text-[6px] text-white font-bold">A</div>
            <span className="text-[8px] text-slate-500 font-bold text-slate-600">벽돌 추가</span>
          </div>
        </div>
      </div>
    </div>
  );
}
