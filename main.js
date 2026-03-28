const { Bodies, Body, Composite, Engine, Events, Render, Runner, Sleeping } = Matter;

// 定数設定
const CANVAS_WIDTH = 688;
const CANVAS_HEIGHT = 785;
const OFFSET_X = 28;
const OFFSET_Y = 39;
const GAME_WIDTH = 630;
const GAME_HEIGHT = 700;
const DEADLINE_Y = 220;

const WALL_T = 60;
const FRICTION = 0.1;
const RESTITUTION = 0.2;

// レベルごとの半径（直径の半分）
const RADIUS_BY_LEVEL = {
  0: 20,
  1: 30,
  2: 40,
  3: 50,
  4: 60,
  5: 70,
  6: 80,
  7: 90,
  8: 100,
  9: 110,
  10: 120
};

const BUBBLE_IMAGES = {};
for (let i = 0; i <= 10; i++) {
  BUBBLE_IMAGES[i] = `./lvcoin_${i}.png`;
}

const OBJECT_CATEGORIES = {
  WALL: 0x0001,
  BUBBLE: 0x0002,
  BUBBLE_PENDING: 0x0004,
};

class BubbeGame {
  constructor(container, message, scoreChangeCallBack) {
    this.message = message;
    this.scoreChangeCallBack = scoreChangeCallBack;
    this.nextCoinLevel = null;

    this.engine = Engine.create({
      constraintIterations: 10,
      positionIterations: 10
    });

    this.render = Render.create({
      element: container,
      engine: this.engine,
      options: {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        wireframes: false,
        background: 'transparent'
      },
    });

    this.runner = Runner.create();
    Render.run(this.render);
  
    window.addEventListener("mousedown", (e) => this.handleClick(e));
    window.addEventListener("mousemove", (e) => this.handleMouseMove(e));

    Events.on(this.engine, "collisionStart", (e) => this.handleCollision(e));
    Events.on(this.engine, "afterUpdate", () => this.checkGameOver());
  }

  getRadiusByLevel(level) {
    return RADIUS_BY_LEVEL[level] || 20;
  }

  updateNextCoinImage(level) {
    const nextCoinImg = document.getElementById("nextCoinImage");
    if (nextCoinImg) {
      nextCoinImg.src = BUBBLE_IMAGES[level];
      nextCoinImg.style.display = "block";
    }
  }

  init() {
    Runner.stop(this.runner);
    Composite.clear(this.engine.world);
    this.gameover = false;
    this.setScore(0);
    this.currentBubble = undefined;
    this.nextCoinLevel = null;

    const nextCoinImg = document.getElementById("nextCoinImage");
    if (nextCoinImg) {
      nextCoinImg.style.display = "none";
    }

    const ground = Bodies.rectangle(
      CANVAS_WIDTH / 2,
      OFFSET_Y + GAME_HEIGHT + WALL_T / 2,
      GAME_WIDTH,
      WALL_T,
      { isStatic: true, label: "ground", render: { visible: false } }
    );
    const leftWall = Bodies.rectangle(
      OFFSET_X - WALL_T / 2,
      OFFSET_Y + GAME_HEIGHT / 2,
      WALL_T,
      GAME_HEIGHT * 2,
      { isStatic: true, label: "leftWall", render: { visible: false } }
    );
    const rightWall = Bodies.rectangle(
      OFFSET_X + GAME_WIDTH + WALL_T / 2,
      OFFSET_Y + GAME_HEIGHT / 2,
      WALL_T,
      GAME_HEIGHT * 2,
      { isStatic: true, label: "rightWall", render: { visible: false } }
    );

    Composite.add(this.engine.world, [ground, leftWall, rightWall]);
    Runner.run(this.runner, this.engine);

    this.gameStatus = "ready";
    this.showReadyMessage();
  }

  start() {
    if (this.gameStatus === "ready") {
      this.gameStatus = "canput";
      this.resetMessage();

      this.nextCoinLevel = Math.floor(Math.random() * 4);
      this.updateNextCoinImage(this.nextCoinLevel);

      this.createNewBubble();
    }
  }

  createNewBubble() {
    if (this.gameover) return;

    let level;
    if (this.nextCoinLevel !== null) {
      level = this.nextCoinLevel;
      this.nextCoinLevel = null;
    } else {
      level = Math.floor(Math.random() * 4);
    }

    const radius = this.getRadiusByLevel(level);

    const currentBubble = Bodies.circle(this.defaultX || CANVAS_WIDTH / 2, OFFSET_Y + 50, radius, {
      isSleeping: true,
      label: "bubble_" + level,
      friction: FRICTION,
      restitution: RESTITUTION,
      collisionFilter: {
        category: OBJECT_CATEGORIES.BUBBLE_PENDING,
        mask: OBJECT_CATEGORIES.WALL
      },
      render: {
        sprite: {
          texture: BUBBLE_IMAGES[level],
          xScale: 1.0,
          yScale: 1.0,
        }
      },
    });

    this.currentBubble = currentBubble;
    Composite.add(this.engine.world, [currentBubble]);

    this.generateNextCoin();
  }

  generateNextCoin() {
    if (this.gameover) return;

    this.nextCoinLevel = Math.floor(Math.random() * 4);
    this.updateNextCoinImage(this.nextCoinLevel);
  }

  putCurrentBubble() {
    if (this.currentBubble) {
      Sleeping.set(this.currentBubble, false);
      this.currentBubble.collisionFilter.category = OBJECT_CATEGORIES.BUBBLE;
      this.currentBubble.collisionFilter.mask = OBJECT_CATEGORIES.WALL | OBJECT_CATEGORIES.BUBBLE;
      this.currentBubble = undefined;
    }
  }

  handleCollision({ pairs }) {
    for (const pair of pairs) {
      const { bodyA, bodyB } = pair;

      if (bodyA.label === bodyB.label && bodyA.label.startsWith("bubble_")) {
        const currentLevel = Number(bodyA.label.substring(7));

        Composite.remove(this.engine.world, [bodyA, bodyB]);
        this.setScore(this.score + (currentLevel + 1) * 10);

        if (currentLevel < 10) {
          const newLevel = currentLevel + 1;
          const newX = (bodyA.position.x + bodyB.position.x) / 2;
          const newY = (bodyA.position.y + bodyB.position.y) / 2;
          const newRadius = this.getRadiusByLevel(newLevel);

          const newBubble = Bodies.circle(newX, newY, newRadius, {
            label: "bubble_" + newLevel,
            friction: FRICTION,
            restitution: RESTITUTION,
            collisionFilter: {
              category: OBJECT_CATEGORIES.BUBBLE,
              mask: OBJECT_CATEGORIES.WALL | OBJECT_CATEGORIES.BUBBLE,
            },
            render: {
              sprite: {
                texture: BUBBLE_IMAGES[newLevel],
                xScale: 1.0,
                yScale: 1.0,
              }
            },
          });
          Composite.add(this.engine.world, [newBubble]);
        }
      }
    }
  }

  checkGameOver() {
    if (this.gameover || this.gameStatus === "ready") return;

    const bubbles = Composite.allBodies(this.engine.world).filter((body) =>
      body.label.startsWith("bubble_") && body !== this.currentBubble
    );

    for (const bubble of bubbles) {
      // デッドラインより上にある場合
      if (bubble.position.y < DEADLINE_Y) {
        // 静止時間を計測するプロパティがなければ初期化
        if (bubble.staticTimer === undefined) {
          bubble.staticTimer = 0;
        }

        // 速度が十分に小さいか判定（X方向とY方向の両方をチェック）
        const isNearlyStatic = Math.abs(bubble.velocity.y) < 0.2 && Math.abs(bubble.velocity.x) < 0.2;

        if (isNearlyStatic) {
          bubble.staticTimer++;
        } else {
          bubble.staticTimer = 0;
        }

        if (bubble.staticTimer > 60) {
          this.gameover = true;
          this.showGameOverMessage();
          break;
        }
      } else {
        // デッドラインより下の場合はタイマーリセット
        if (bubble.staticTimer !== undefined) {
          bubble.staticTimer = 0;
        }
      }
    }
  }

  handleMouseMove(e) {
    if (this.gameStatus !== "canput" || !this.currentBubble) return;

    const rect = this.render.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const level = Number(this.currentBubble.label.substring(7));
    const radius = this.getRadiusByLevel(level);
    const minX = OFFSET_X + radius;
    const maxX = OFFSET_X + GAME_WIDTH - radius;
    const newX = Math.max(Math.min(x, maxX), minX);

    Body.setPosition(this.currentBubble, {
      x: newX,
      y: this.currentBubble.position.y,
    });
    this.defaultX = newX;
  }

  handleClick(e) {
    if (this.gameover || this.gameStatus !== "canput") return;

    // クリックされた座標を取得
    const rect = this.render.canvas.getBoundingClientRect();
    let clickX = e.clientX - rect.left;

    // クリック位置がゲームエリアの範囲外の場合、範囲内に補正
    const level = Number(this.currentBubble.label.substring(7));
    const radius = this.getRadiusByLevel(level);
    const minX = OFFSET_X + radius;
    const maxX = OFFSET_X + GAME_WIDTH - radius;

    // クリック位置を範囲内にクランプ
    clickX = Math.max(Math.min(clickX, maxX), minX);

    // 現在のコインの位置を更新
    if (this.currentBubble) {
      Body.setPosition(this.currentBubble, {
        x: clickX,
        y: this.currentBubble.position.y,
      });
      this.defaultX = clickX;
    }

    this.putCurrentBubble();
    this.gameStatus = "interval";

    setTimeout(() => {
      if (!this.gameover) {
        this.createNewBubble();
        this.gameStatus = "canput";
      }
    }, 600);
  }

  setScore(score) {
    this.score = score;
    if (this.scoreChangeCallBack) this.scoreChangeCallBack(score);

    // スコア表示を更新
    const scoreValue = document.querySelector(".score-value");
    if (scoreValue) {
      scoreValue.textContent = score;
    }
  }

  showReadyMessage() {
    this.message.innerHTML = `<p class="mainText">LV COIN GAME</p><button class="button" id="startBtn">START</button>`;
    this.message.style.display = "block";
    document.getElementById("startBtn").onclick = () => this.start();
  }

  showGameOverMessage() {
    this.message.innerHTML = `<p class="mainText">Game Over</p><button class="button" id="retryBtn">RETRY</button>`;
    this.message.style.display = "block";
    document.getElementById("retryBtn").onclick = () => this.init();
  }

  resetMessage() {
    this.message.style.display = "none";
  }
}

window.onload = () => {
  const container = document.querySelector(".container");
  const message = document.querySelector(".message");
  const onChangeScore = (val) => {
    // スコア表示は setScore 内で直接更新するため、ここでは何もしない
  };

  const game = new BubbeGame(container, message, onChangeScore);
  game.init();
};
