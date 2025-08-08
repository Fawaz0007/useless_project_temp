/* DUCK HUNT: THE RECKONING (Psyche! Edition)
   Minimal HTML5/Canvas implementation: core loop, fake deaths, resurrection + taunts,
   egg retaliation, yolk splats, HUD, title and game over. CRT overlay handled in CSS. */

   (() => {
    const CANVAS_WIDTH = 256;
    const CANVAS_HEIGHT = 240;
    const GROUND_Y = 190; // top of ground strip
    const SHOT_COOLDOWN_MS = 220;
    const INITIAL_LIVES = 3;
  
    const POINTS_SHOT = 500;
    const POINTS_RESURRECT_PENALTY = 1000;
    const POINTS_BOSS_EXIT_PENALTY = 5000; // placeholder if boss added later
  
    // Difficulty progression (simple MVP curve)
    const DIFFICULTY_BY_ROUND = [
      { round: 1, ducks: 2, eggSpeed: 70, rof: 0.9, bossChance: 0 },
      { round: 2, ducks: 3, eggSpeed: 80, rof: 0.8, bossChance: 0.05 },
      { round: 3, ducks: 4, eggSpeed: 95, rof: 0.7, bossChance: 0.07 },
      { round: 4, ducks: 5, eggSpeed: 110, rof: 0.55, bossChance: 0.1 },
      { round: 5, ducks: 6, eggSpeed: 130, rof: 0.45, bossChance: 0.12 },
      { round: 6, ducks: 6, eggSpeed: 140, rof: 0.4, bossChance: 0.15 },
    ];
  
    // DOM references
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const hudRound = document.getElementById('round');
    const hudScore = document.getElementById('score');
    const hudLives = document.getElementById('lives');
    const hitFlash = document.getElementById('hitflash');
    const contractorBox = document.getElementById('contractor');
    const screenTitle = document.getElementById('title');
    const screenGameOver = document.getElementById('gameover');
    const screenPause = document.getElementById('pause');
    const finalScoreEl = document.getElementById('finalscore');
    const gameRoot = document.getElementById('game-root');
    const SCALE_EL = getComputedStyle(document.documentElement).getPropertyValue('--scale').trim();
    const CSS_SCALE = parseFloat(SCALE_EL || '3');
  
    // Input state
    const mouse = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, isDown: false };
    let lastShotAtMs = 0;
  
    // Audio manager (simple WebAudio chiptune + SFX)
    class AudioManager {
      constructor() {
        this.actx = null;
        this.musicInterval = null;
        this.musicState = 'happy'; // 'happy' | 'minor'
        this.scratchPlayed = false;
        this.masterGain = null;
      }
      ensure() {
        if (this.actx) return;
        this.actx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.actx.createGain();
        this.masterGain.gain.value = 0.25;
        this.masterGain.connect(this.actx.destination);
      }
      now() { return this.actx ? this.actx.currentTime : 0; }
      playBeep(freq = 440, dur = 0.1, type = 'square', vol = 0.3) {
        this.ensure();
        const o = this.actx.createOscillator();
        const g = this.actx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = vol;
        o.connect(g).connect(this.masterGain);
        const t = this.now();
        o.start();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.stop(t + dur + 0.01);
      }
      playZapper() { this.playBeep(1400, 0.06, 'square', 0.35); this.playBeep(900, 0.08, 'sawtooth', 0.2); }
      playBoop() { this.playBeep(220, 0.15, 'triangle', 0.25); }
      playQuackLaugh() { this.playBeep(600, 0.06, 'square', 0.25); this.playBeep(520, 0.06, 'square', 0.25); this.playBeep(440, 0.08, 'square', 0.25); }
      playQuackOof() { this.playBeep(300, 0.12, 'triangle', 0.2); }
      playEggImpact() { this.playBeep(160, 0.08, 'square', 0.25); }
      playRecordScratch() {
        this.ensure();
        if (this.scratchPlayed) return;
        this.scratchPlayed = true;
        // Noise burst
        const bufferSize = 2 * this.actx.sampleRate;
        const noiseBuffer = this.actx.createBuffer(1, bufferSize, this.actx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) { output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); }
        const whiteNoise = this.actx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        const filter = this.actx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        const g = this.actx.createGain();
        g.gain.value = 0.35;
        whiteNoise.connect(filter).connect(g).connect(this.masterGain);
        whiteNoise.start();
        whiteNoise.stop(this.now() + 0.18);
      }
      startMusicHappy() {
        this.ensure();
        this.stopMusic();
        this.musicState = 'happy';
        const pattern = [440, 494, 523, 587, 523, 494, 440, 392]; // cheerful arpeggio
        let idx = 0;
        this.musicInterval = setInterval(() => {
          if (!this.actx) return;
          const freq = pattern[idx % pattern.length];
          this.playBeep(freq, 0.08, 'square', 0.12);
          this.playBeep(freq / 2, 0.12, 'triangle', 0.07);
          idx++;
        }, 140);
      }
      switchToMinorLoop() {
        if (this.musicState === 'minor') return;
        this.playRecordScratch();
        this.stopMusic();
        this.musicState = 'minor';
        const pattern = [392, 370, 392, 415, 392, 349, 330, 311]; // ominous minor-ish
        let idx = 0;
        this.musicInterval = setInterval(() => {
          const freq = pattern[idx % pattern.length];
          this.playBeep(freq, 0.1, 'square', 0.12);
          this.playBeep(freq / 2, 0.14, 'triangle', 0.06);
          idx++;
        }, 180);
      }
      stopMusic() { if (this.musicInterval) { clearInterval(this.musicInterval); this.musicInterval = null; } }
    }
  
    const audio = new AudioManager();
  
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function rand(min, max) { return Math.random() * (max - min) + min; }
    function randInt(min, max) { return Math.floor(rand(min, max)); }
    function chance(p) { return Math.random() < p; }
  
    class Egg {
      constructor(x, y, vx, vy, speed) {
        this.x = x; this.y = y;
        const len = Math.hypot(vx, vy) || 1;
        this.vx = (vx / len) * speed;
        this.vy = (vy / len) * speed;
        this.radius = 2.5;
        this.alive = true;
        this.cracked = false;
      }
      update(dt) {
        if (!this.alive) return;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.x < -10 || this.x > CANVAS_WIDTH + 10 || this.y < -10 || this.y > CANVAS_HEIGHT + 10) {
          this.alive = false;
        }
      }
      draw(ctx) {
        ctx.fillStyle = '#eed35f';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff08a';
        ctx.fillRect(this.x - 0.8, this.y - 1.6, 1.6, 1.1);
      }
    }
  
    class Duck {
      constructor(game, x, y, isBoss = false) {
        this.game = game;
        this.x = x; this.y = y;
        this.vx = rand(-20, 20); this.vy = rand(-10, 10);
        this.state = 'fly'; // fly | shot | ground | resurrect | taunt | attack | escape
        this.timeInState = 0;
        this.size = isBoss ? 18 : 12;
        this.signText = null;
        this.faceDir = 1; // 1 right, -1 left
        this.isBoss = isBoss;
        this.hp = isBoss ? 3 : 1;
        this.attackCooldown = 0;
        this.rof = 0.8; // seconds, updated by round
        this.eggSpeed = 80; // px/s, updated by round
        this.helmet = false;
      }
      applyDifficulty(d) {
        this.rof = d.rof;
        this.eggSpeed = d.eggSpeed;
        this.helmet = this.game.round >= 3 && chance(0.45);
      }
      bbox() { return { x: this.x - this.size/2, y: this.y - this.size/2, w: this.size, h: this.size }; }
      hitTest(px, py) {
        const b = this.bbox();
        return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h && this.state === 'fly';
      }
      setState(s) { this.state = s; this.timeInState = 0; }
      shootAt(targetX, targetY) {
        const egg = new Egg(this.x, this.y, targetX - this.x, targetY - this.y, this.eggSpeed);
        this.game.eggs.push(egg);
      }
      update(dt) {
        this.timeInState += dt;
        switch (this.state) {
          case 'fly': {
            // Wander within sky region
            this.x += this.vx * dt; this.y += this.vy * dt;
            if (this.x < 16 || this.x > CANVAS_WIDTH - 16) this.vx *= -1;
            if (this.y < 20 || this.y > GROUND_Y - 20) this.vy *= -1;
            this.faceDir = this.vx >= 0 ? 1 : -1;
            // Randomly flap velocity
            if (chance(0.01)) { this.vx = rand(-40, 40); this.vy = rand(-20, 20); }
            // Escape after some time
            if (this.timeInState > 8) this.setState('escape');
            break;
          }
          case 'shot': {
            // Dramatic leaf fall
            this.vy += 60 * dt; // gravity-ish
            this.x += Math.sin(this.timeInState * 12) * 20 * dt;
            this.y += this.vy * dt;
            if (this.y >= GROUND_Y - this.size / 2) { this.y = GROUND_Y - this.size / 2; this.vy = 0; this.setState('ground'); }
            break;
          }
          case 'ground': {
            // Twitch then resurrect
            if (this.timeInState > 1.1) { this.setState('resurrect'); this.game.onDuckResurrect(); }
            break;
          }
          case 'resurrect': {
            // Stand and face player
            if (this.timeInState > 0.4) this.setState('taunt');
            break;
          }
          case 'taunt': {
            // Choose and play quick taunt, then attack
            if (this.timeInState < 0.05) {
              const r = Math.random();
              if (r < 0.5) { audio.playQuackLaugh(); }
              else if (r < 0.8) { this.signText = Duck.randomSignText(); setTimeout(() => this.signText = null, 900); }
              else { /* dance: flip direction repeatedly */ }
              // Also spawn readable bubble near duck
              spawnTauntBubbleAt(this.x, this.y - this.size, Duck.randomSignText());
            }
            // brief dance by flipping
            if (this.timeInState > 0.12 && this.timeInState < 0.8 && ((this.timeInState * 10) | 0) % 2 === 0) this.faceDir *= -1;
            if (this.timeInState > 1.0) { this.setState('attack'); }
            break;
          }
          case 'attack': {
            // Fire eggs toward cursor, with some inaccuracy, repeat by ROF
            this.attackCooldown -= dt;
            if (this.attackCooldown <= 0) {
              const jitter = () => rand(-8, 8);
              this.shootAt(this.game.cursorX + jitter(), this.game.cursorY + jitter());
              this.attackCooldown = this.rof;
            }
            // Rejoin flight after some time
            if (this.timeInState > 4) { this.setState('fly'); }
            break;
          }
          case 'escape': {
            this.x += 50 * dt * this.faceDir; this.y -= 20 * dt;
            break;
          }
        }
      }
      draw(ctx) {
        // Body with chunky outlines & simple shading
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.faceDir < 0) ctx.scale(-1, 1);
        // Color by state
        let body = '#7cd67c';
        if (this.state === 'shot' || this.state === 'ground') body = '#9e6b6b';
        ctx.fillStyle = body;
        const bx = -this.size/2, by = -this.size/3, bw = this.size * 0.8, bh = this.size * 0.6;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
        ctx.strokeRect(Math.floor(bx)+0.5, Math.floor(by)+0.5, Math.floor(bw), Math.floor(bh));
        // Head
        ctx.fillStyle = '#5aa85a';
        const hx = this.size * 0.1, hy = -this.size * 0.45, hw = this.size * 0.35, hh = this.size * 0.35;
        ctx.fillRect(hx, hy, hw, hh);
        ctx.strokeStyle = '#000'; ctx.strokeRect(Math.floor(hx)+0.5, Math.floor(hy)+0.5, Math.floor(hw), Math.floor(hh));
        // Beak
        ctx.fillStyle = '#f3c066';
        const ex = this.size * 0.45, ey = -this.size * 0.35, ew = this.size * 0.25, eh = this.size * 0.12;
        ctx.fillRect(ex, ey, ew, eh);
        ctx.strokeStyle = '#000'; ctx.strokeRect(Math.floor(ex)+0.5, Math.floor(ey)+0.5, Math.floor(ew), Math.floor(eh));
        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(hx + hw - 4, hy + 4, 3, 3);
        // Wing flap
        ctx.fillStyle = '#6cc46c';
        const flap = Math.sin(performance.now() / 100) * 3;
        ctx.fillRect(-this.size * 0.2, -this.size * 0.6 + flap, this.size * 0.5, this.size * 0.18);
        // Helmet cosmetic
        if (this.helmet) {
          ctx.fillStyle = '#b0b0b0';
          ctx.fillRect(this.size * 0.05, -this.size * 0.5, this.size * 0.35, this.size * 0.15);
          ctx.strokeStyle = '#000';
          ctx.strokeRect(Math.floor(this.size * 0.05)+0.5, Math.floor(-this.size * 0.5)+0.5, Math.floor(this.size * 0.35), Math.floor(this.size * 0.15));
        }
        // Sign taunt
        if (this.signText) {
          ctx.fillStyle = '#8b5a2b';
          ctx.fillRect(-10, -this.size - 10, 20, 2); // stick
          ctx.fillStyle = '#d6b48a';
          ctx.fillRect(8, -this.size - 16, 30, 16);
          ctx.fillStyle = '#000';
          ctx.font = '6px "Press Start 2P", monospace';
          ctx.fillText(this.signText, 10, -this.size - 6);
        }
        // Feet on ground
        if (this.state === 'ground' || this.state === 'resurrect' || this.state === 'taunt') {
          ctx.fillStyle = '#f3c066';
          ctx.fillRect(-4, this.size * 0.1, 3, 3);
          ctx.fillRect(2, this.size * 0.1, 3, 3);
        }
        ctx.restore();
      }
      onPlayerShot() {
        if (this.state !== 'fly') return;
        this.game.onDuckShot();
        audio.playQuackOof();
        this.setState('shot');
      }
      static randomSignText() {
        const t = [
          'LOL', 'U MAD?', 'NICE AIM', ":')", 'BRUH',
          'TRY AGAIN', 'PATHETIC', 'WHIFF', 'CRY MORE', 'TOO SLOW',
          'PEW PEW MISS', 'SKILL ISSUE', 'GIT GUD', 'COPE + SEETHE'
        ];
        return t[randInt(0, t.length)];
      }
    }
  
    class Game {
      constructor() {
        this.state = 'title'; // title | playing | paused | gameover
        this.score = 0;
        this.lives = INITIAL_LIVES;
        this.round = 0;
        this.ducks = [];
        this.eggs = [];
        this.lastTime = performance.now();
        this.cursorX = CANVAS_WIDTH / 2;
        this.cursorY = CANVAS_HEIGHT / 2;
        this.escalationTimer = 0;
        this.firstResurrectionDone = false;
  
        this.bindEvents();
        this.updateHUD();
        this.loop();
      }
      bindEvents() {
        // Mouse
        canvas.addEventListener('mousemove', (e) => {
          const rect = canvas.getBoundingClientRect();
          const scaleX = CANVAS_WIDTH / rect.width;
          const scaleY = CANVAS_HEIGHT / rect.height;
          this.cursorX = clamp((e.clientX - rect.left) * scaleX, 0, CANVAS_WIDTH);
          this.cursorY = clamp((e.clientY - rect.top) * scaleY, 0, CANVAS_HEIGHT);
          mouse.x = this.cursorX; mouse.y = this.cursorY;
        });
        const shootHandler = (e) => {
          mouse.isDown = true;
          if (this.state === 'title') { this.startGame(); return; }
          if (this.state !== 'playing') { if (this.state === 'gameover') this.resetAndStart(); return; }
          this.tryShoot();
        };
        canvas.addEventListener('mousedown', shootHandler);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); shootHandler(e.changedTouches[0]); }, { passive: false });
        window.addEventListener('mouseup', () => { mouse.isDown = false; });
  
        // Keyboard
        window.addEventListener('keydown', (e) => {
          if ((e.key === 'Enter' || e.key === ' ') && this.state === 'title') this.startGame();
          else if ((e.key === 'Enter' || e.key === ' ') && this.state === 'gameover') this.resetAndStart();
          else if (e.key.toLowerCase() === 'p' && this.state === 'playing') this.pauseGame();
          else if (e.key.toLowerCase() === 'p' && this.state === 'paused') this.resumeGame();
          else if (e.key === 'Escape' && (this.state === 'playing' || this.state === 'paused')) this.endGame();
        });
      }
      startGame() {
        screenTitle.classList.add('hidden');
        screenTitle.classList.remove('show');
        audio.startMusicHappy();
        this.state = 'playing';
        this.score = 0; this.lives = INITIAL_LIVES; this.round = 0;
        this.firstResurrectionDone = false;
        this.nextRound();
        this.updateHUD();
      }
      pauseGame() {
        this.state = 'paused';
        screenPause.classList.remove('hidden');
      }
      resumeGame() {
        this.state = 'playing';
        screenPause.classList.add('hidden');
      }
      resetAndStart() {
        screenGameOver.classList.add('hidden');
        this.startGame();
      }
      endGame() {
        this.state = 'gameover';
        audio.stopMusic();
        finalScoreEl.textContent = `${this.score}`;
        screenGameOver.classList.remove('hidden');
      }
      onDuckShot() {
        this.score += POINTS_SHOT;
        this.updateHUD();
        showHitFlash();
        audio.playZapper();
      }
      onDuckResurrect() {
        this.score -= POINTS_RESURRECT_PENALTY;
        this.updateHUD();
        if (!this.firstResurrectionDone) {
          this.firstResurrectionDone = true;
          audio.switchToMinorLoop();
        }
        // Spawn readable taunt bubble near a random duck currently resurrecting/taunting
        const d = this.ducks.find(dd => dd.state === 'resurrect' || dd.state === 'taunt');
        if (d) spawnTauntBubbleAt(d.x, d.y - d.size, Duck.randomSignText());
      }
      onPlayerHit(x, y) {
        this.lives -= 1;
        this.updateHUD();
        audio.playEggImpact();
        spawnYolkAt(x, y);
        if (this.lives <= 0) this.endGame();
      }
      nextRound() {
        this.round += 1;
        this.escalationTimer = 0;
        this.ducks.length = 0;
        const diff = DIFFICULTY_BY_ROUND[Math.min(this.round - 1, DIFFICULTY_BY_ROUND.length - 1)];
        for (let i = 0; i < diff.ducks; i++) {
          const d = new Duck(this, rand(40, CANVAS_WIDTH - 40), rand(30, GROUND_Y - 40));
          d.applyDifficulty(diff);
          this.ducks.push(d);
        }
        this.updateHUD();
      }
      tryShoot() {
        const now = performance.now();
        if (now - lastShotAtMs < SHOT_COOLDOWN_MS) return;
        lastShotAtMs = now;
  
        let hitSomething = false;
        for (const d of this.ducks) {
          if (d.hitTest(this.cursorX, this.cursorY)) { d.onPlayerShot(); hitSomething = true; }
        }
        if (!hitSomething) {
          // Attempt to shoot dog? If aiming low in grass, show contractor message
          if (this.cursorY > GROUND_Y - 4) {
            audio.playBoop();
            contractorBox.classList.remove('hidden');
            setTimeout(() => contractorBox.classList.add('hidden'), 1400);
          } else {
            audio.playZapper();
          }
        }
      }
      update(dt) {
        if (this.state !== 'playing') return;
        this.escalationTimer += dt;
        // Advance round every ~20 seconds
        if (this.escalationTimer > 20) this.nextRound();
  
        for (const d of this.ducks) d.update(dt);
        for (const e of this.eggs) e.update(dt);
        // Egg collision vs crosshair (player)
        for (const e of this.eggs) {
          if (!e.alive) continue;
          const dx = e.x - this.cursorX, dy = e.y - this.cursorY;
          if (dx*dx + dy*dy < 7*7) { // hit radius around crosshair
            e.alive = false;
            this.onPlayerHit(this.cursorX, this.cursorY);
            spawnEggCrackAt(this.cursorX, this.cursorY);
          }
        }
        // Cleanup
        this.eggs = this.eggs.filter(e => e.alive);
        // If all ducks escaped back to fly and offscreen? Keep them; endless loop.
      }
      draw() {
        // Sky gradient already from CSS; add sun and mountains for visual depth
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        // Sun
        ctx.fillStyle = '#ffe27a';
        ctx.beginPath(); ctx.arc(30, 30, 14, 0, Math.PI*2); ctx.fill();
        // Mountains
        ctx.fillStyle = '#2a5b7f';
        ctx.beginPath(); ctx.moveTo(0, 140); ctx.lineTo(40, 90); ctx.lineTo(80, 140); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(60, 150); ctx.lineTo(110, 95); ctx.lineTo(160, 150); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(130, 140); ctx.lineTo(180, 100); ctx.lineTo(230, 140); ctx.closePath(); ctx.fill();
        // Parallax clouds (simple stripes)
        ctx.fillStyle = '#ffffff22';
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(((performance.now()/50) + i*80) % (CANVAS_WIDTH+60) - 60, 30 + i*20, 40, 8);
        }
        // Ground
        ctx.fillStyle = '#6bb36b';
        ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
        // Grass
        ctx.fillStyle = '#3f8f3f';
        for (let x = 0; x < CANVAS_WIDTH; x += 8) ctx.fillRect(x, GROUND_Y - 3 - ((x/8)%2), 8, 3 + ((x/8)%2));
  
        // Ducks
        for (const d of this.ducks) d.draw(ctx);
        // Eggs
        for (const e of this.eggs) e.draw(ctx);
        // Dog aesthetic: intro and game over shrug
        this.drawDog(ctx);
  
        // Crosshair
        drawCrosshair(ctx, this.cursorX, this.cursorY);
      }
      drawDog(ctx) {
        // Simple pixel dog in the grass near left side
        const baseX = 20;
        const baseY = GROUND_Y - 2;
        ctx.save();
        ctx.translate(baseX, baseY);
        // Body
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(-6, -10, 20, 10);
        // Head
        ctx.fillStyle = '#a46b32';
        ctx.fillRect(12, -16, 10, 10);
        // Ear
        ctx.fillStyle = '#6d431e';
        ctx.fillRect(12, -18, 4, 4);
        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(19, -12, 2, 2);
        // Nose
        ctx.fillRect(22, -9, 2, 2);
        // Legs
        ctx.fillStyle = '#6d431e';
        ctx.fillRect(-4, -2, 3, 2);
        ctx.fillRect(4, -2, 3, 2);
        // If gameover, draw shrug sign
        if (this.state === 'gameover') {
          ctx.fillStyle = '#d6b48a';
          ctx.fillRect(28, -18, 24, 12);
          ctx.fillStyle = '#000';
          ctx.font = '6px "Press Start 2P", monospace';
          ctx.fillText('¯\\_(ツ)_/¯', 30, -9);
        }
        ctx.restore();
      }
      loop() {
        const now = performance.now();
        const dt = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;
        this.update(dt);
        this.draw();
        requestAnimationFrame(() => this.loop());
      }
      updateHUD() {
        hudRound.textContent = `R=${this.round}`;
        hudScore.textContent = `SCORE ${this.score}`;
        hudLives.textContent = '❤'.repeat(this.lives) + ' '.repeat(Math.max(0, INITIAL_LIVES - this.lives));
      }
    }
  
    function drawCrosshair(ctx, x, y) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
      ctx.restore();
    }
  
    function showHitFlash() {
      hitFlash.style.opacity = '1';
      setTimeout(() => (hitFlash.style.opacity = '0'), 150);
    }
  
    function spawnYolkAt(x, y) {
      // Place using percentage so it scales with CSS
      const yolk = document.createElement('div');
      yolk.className = 'yolk';
      yolk.style.left = `${(x / CANVAS_WIDTH) * 100}%`;
      yolk.style.top = `${(y / CANVAS_HEIGHT) * 100}%`;
      yolk.style.transform = 'translate(-50%, -50%)';
      gameRoot.appendChild(yolk);
      setTimeout(() => yolk.remove(), 2000);
    }
  
    function spawnEggCrackAt(x, y) {
      // Crack overlay with simple pixel lines
      const crack = document.createElement('canvas');
      const px = Math.round(32 * CSS_SCALE);
      crack.width = px; crack.height = px;
      crack.style.position = 'absolute';
      crack.style.left = `${(x / CANVAS_WIDTH) * 100}%`;
      crack.style.top = `${(y / CANVAS_HEIGHT) * 100}%`;
      crack.style.transform = 'translate(-50%, -50%)';
      crack.style.pointerEvents = 'none';
      crack.style.opacity = '0.95';
      crack.style.filter = 'drop-shadow(0 0 3px rgba(255,255,255,0.4))';
      gameRoot.appendChild(crack);
      const cctx = crack.getContext('2d');
      cctx.imageSmoothingEnabled = false;
      cctx.strokeStyle = '#fff8b0';
      cctx.lineWidth = Math.max(1, Math.round(1 * CSS_SCALE));
      cctx.beginPath();
      const cx = px/2, cy = px/2;
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI * 2 * i) / 6 + rand(-0.2, 0.2);
        const len = px/2 + rand(-4, 6);
        cctx.moveTo(cx, cy);
        cctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
      }
      cctx.stroke();
      // Fade out
      setTimeout(() => {
        crack.style.transition = 'opacity 1s linear';
        crack.style.opacity = '0';
        setTimeout(() => crack.remove(), 1000);
      }, 80);
    }
  
    function spawnTauntBubbleAt(x, y, text) {
      const el = document.createElement('div');
      el.className = 'taunt';
      el.textContent = text;
      el.style.left = `${(x / CANVAS_WIDTH) * 100}%`;
      el.style.top = `${(y / CANVAS_HEIGHT) * 100}%`;
      gameRoot.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }
  
    // Boot
    const game = new Game();
  })();
  
  
  