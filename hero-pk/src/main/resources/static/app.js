const { createApp } = Vue;

createApp({
  data() {
    return {
      heroes: [],
      leftHeroId: '',
      rightHeroId: '',
      result: null,
      meta: null,
      loading: false,
      visibleLogs: [],
      playbackTimer: null,
      playbackIndex: 0,
      playbackSpeed: 800,
      playing: false,
      battleFinished: false,
      currentLeftHp: 0,
      currentRightHp: 0,
      currentEvent: '卷轴待启，江湖静候开战。',
      leftPulseTick: 0,
      rightPulseTick: 0,
      leftActionClass: '',
      rightActionClass: '',
      stageFxClass: '',
      stageFxText: '',
      stageFxOwner: 'center',
      fxTimer: null,
    };
  },
  computed: {
    leftHero() {
      return this.heroes.find((h) => h.id === this.leftHeroId) || null;
    },
    rightHero() {
      return this.heroes.find((h) => h.id === this.rightHeroId) || null;
    },
    currentRound() {
      if (!this.visibleLogs.length) return 0;
      return this.visibleLogs[this.visibleLogs.length - 1].round || 0;
    },
    totalRounds() {
      if (!this.result) return 0;
      return this.result.rounds || 0;
    },
    progressPercent() {
      if (!this.result || !this.result.logs || !this.result.logs.length) return 0;
      return Math.round((this.visibleLogs.length / this.result.logs.length) * 100);
    },
    currentEventTone() {
      const text = String(this.currentEvent || '');
      if (/暴击|重击|连击/.test(text)) return 'event-danger';
      if (/中毒|眩晕/.test(text)) return 'event-toxic';
      if (/平衡|爆发窗口|劣势/.test(text)) return 'event-system';
      if (/未命中|格挡/.test(text)) return 'event-neutral';
      return 'event-normal';
    },
    leftPulseClass() {
      return this.leftPulseTick ? 'hp-pulse' : '';
    },
    rightPulseClass() {
      return this.rightPulseTick ? 'hp-pulse' : '';
    },
  },
  methods: {
    toPct(v) {
      return `${Math.round(v * 100)}%`;
    },
    toInt(v) {
      return Math.round(v || 0);
    },
    buffText(v) {
      const n = Math.round((v || 0) * 100);
      if (n === 0) return '0%';
      return `${n > 0 ? '+' : ''}${n}%`;
    },
    async bootstrap() {
      const [heroes, meta] = await Promise.all([
        fetch('/api/heroes').then((r) => r.json()),
        fetch('/api/meta').then((r) => r.json()),
      ]);
      this.heroes = heroes;
      this.meta = meta;
      if (heroes.length >= 2) {
        this.leftHeroId = heroes[0].id;
        this.rightHeroId = heroes[2]?.id || heroes[1].id;
      }
    },
    async simulate() {
      this.stopPlayback();
      this.loading = true;
      try {
        const response = await fetch('/api/battle/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leftHeroId: this.leftHeroId,
            rightHeroId: this.rightHeroId,
            maxRounds: 30,
          }),
        });
        const data = await response.json();
        this.result = data;
        this.startReplay();
      } finally {
        this.loading = false;
      }
    },
    startReplay() {
      this.stopPlayback();
      this.visibleLogs = [];
      this.playbackIndex = 0;
      this.battleFinished = false;
      this.currentLeftHp = this.maxHp('left');
      this.currentRightHp = this.maxHp('right');
      this.currentEvent = '卷轴展开，笔锋入局。';
      this.clearStageFx();
      if (!this.result || !this.result.logs || !this.result.logs.length) return;
      this.playing = true;
      this.playbackTimer = window.setInterval(() => {
        this.playNext();
      }, this.playbackSpeed);
    },
    stopPlayback() {
      if (this.playbackTimer) {
        window.clearInterval(this.playbackTimer);
        this.playbackTimer = null;
      }
      this.playing = false;
    },
    togglePlayback() {
      if (!this.result || !this.result.logs || !this.result.logs.length || this.battleFinished) return;
      if (this.playing) {
        this.stopPlayback();
      } else {
        this.playing = true;
        this.playbackTimer = window.setInterval(() => {
          this.playNext();
        }, this.playbackSpeed);
      }
    },
    replayBattle() {
      if (!this.result) return;
      this.startReplay();
    },
    stepBattle() {
      if (!this.result || !this.result.logs || !this.result.logs.length || this.battleFinished) return;
      this.stopPlayback();
      this.playNext();
    },
    changeSpeed(speed) {
      this.playbackSpeed = speed;
      if (this.playing) {
        this.stopPlayback();
        this.playing = true;
        this.playbackTimer = window.setInterval(() => {
          this.playNext();
        }, this.playbackSpeed);
      }
    },
    playNext() {
      if (!this.result || !this.result.logs || this.playbackIndex >= this.result.logs.length) {
        this.finishBattlePlayback();
        return;
      }
      const nextLog = this.result.logs[this.playbackIndex];
      const prevLeftHp = this.currentLeftHp;
      const prevRightHp = this.currentRightHp;
      this.visibleLogs.push(nextLog);
      this.playbackIndex += 1;
      this.currentLeftHp = nextLog.leftHp;
      this.currentRightHp = nextLog.rightHp;
      this.currentEvent = this.describeEvent(nextLog);
      this.triggerStageAnimation(nextLog);
      if (nextLog.leftHp < prevLeftHp) {
        this.leftPulseTick = Date.now();
      }
      if (nextLog.rightHp < prevRightHp) {
        this.rightPulseTick = Date.now();
      }

      this.$nextTick(() => {
        const container = document.querySelector('.scroll-log-list');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });

      if (this.playbackIndex >= this.result.logs.length) {
        this.finishBattlePlayback();
      }
    },
    finishBattlePlayback() {
      this.stopPlayback();
      this.battleFinished = true;
      if (this.result && this.result.winner) {
        this.currentEvent = '卷轴封存：' + this.result.winner + ' 名震江湖。';
      }
      this.clearStageFx();
    },
    describeEvent(log) {
      if (!log) return '笔锋未落。';
      const detail = String(log.detail || '');
      if (/暴击/.test(detail)) return '破势暴击，杀气骤升。';
      if (/连击/.test(detail)) return '招式连环，攻势不断。';
      if (/重击/.test(detail) || /眩晕/.test(detail)) return '重击命门，气机受挫。';
      if (/中毒/.test(detail)) return '毒势已起，暗伤蚀骨。';
      if (/平衡|爆发窗口|劣势/.test(detail) || /平衡机制/.test(log.action || '')) return '天机修正，胜势再衡。';
      if (/未命中/.test(detail)) return '虚招掠影，未能得手。';
      if (/格挡/.test(detail)) return '守势稳固，来招尽化。';
      return (log.actor || '江湖') + ' 出手，局势再变。';
    },
    logTone(log) {
      const text = String((log && log.detail) || '');
      const action = String((log && log.action) || '');
      if (/暴击|连击|重击/.test(text) || /武功-伤害/.test(action)) return 'tone-danger';
      if (/中毒|眩晕/.test(text) || /武功-中毒/.test(action)) return 'tone-toxic';
      if (/平衡|爆发窗口|劣势/.test(text) || /平衡机制|天气/.test(action)) return 'tone-system';
      if (/未命中|格挡/.test(text)) return 'tone-neutral';
      return 'tone-normal';
    },
    triggerStageAnimation(log) {
      if (!this.result || !log) return;
      const attackerSide = log.actor === this.result.leftHero ? 'left' : (log.actor === this.result.rightHero ? 'right' : 'center');
      const defenderSide = attackerSide === 'left' ? 'right' : (attackerSide === 'right' ? 'left' : 'center');
      const detail = String(log.detail || '');
      const action = String(log.action || '');

      this.leftActionClass = '';
      this.rightActionClass = '';
      this.stageFxClass = '';
      this.stageFxText = '';
      this.stageFxOwner = 'center';

      if (attackerSide === 'left') {
        this.leftActionClass = 'fighter-attack-left';
      } else if (attackerSide === 'right') {
        this.rightActionClass = 'fighter-attack-right';
      }

      if (/格挡/.test(detail)) {
        if (defenderSide === 'left') this.leftActionClass = 'fighter-guard';
        if (defenderSide === 'right') this.rightActionClass = 'fighter-guard';
        this.stageFxClass = 'fx-guard';
        this.stageFxText = '格挡';
        this.stageFxOwner = defenderSide;
      } else if (/中毒/.test(detail) || /武功-中毒/.test(action)) {
        if (defenderSide === 'left') this.leftActionClass = 'fighter-hit';
        if (defenderSide === 'right') this.rightActionClass = 'fighter-hit';
        this.stageFxClass = 'fx-poison';
        this.stageFxText = '毒雾';
        this.stageFxOwner = defenderSide;
      } else if (/武功-补血/.test(action)) {
        this.stageFxClass = 'fx-heal';
        this.stageFxText = '回春';
        this.stageFxOwner = attackerSide;
      } else if (/武功-伤害|暴击|连击|重击/.test(action + detail)) {
        if (defenderSide === 'left') this.leftActionClass = 'fighter-hit';
        if (defenderSide === 'right') this.rightActionClass = 'fighter-hit';
        this.stageFxClass = /暴击|重击/.test(detail) ? 'fx-critical' : 'fx-slash';
        this.stageFxText = /暴击|重击/.test(detail) ? '破势' : '斩击';
        this.stageFxOwner = defenderSide;
      } else {
        if (defenderSide === 'left') this.leftActionClass = 'fighter-hit';
        if (defenderSide === 'right') this.rightActionClass = 'fighter-hit';
        this.stageFxClass = 'fx-slash';
        this.stageFxText = '交锋';
        this.stageFxOwner = 'center';
      }

      if (this.fxTimer) {
        window.clearTimeout(this.fxTimer);
      }
      this.fxTimer = window.setTimeout(() => {
        this.clearStageFx();
      }, 520);
    },
    clearStageFx() {
      this.leftActionClass = '';
      this.rightActionClass = '';
      this.stageFxClass = '';
      this.stageFxText = '';
      this.stageFxOwner = 'center';
      if (this.fxTimer) {
        window.clearTimeout(this.fxTimer);
        this.fxTimer = null;
      }
    },
    avatarFor(side) {
      if (side === 'left') return '/avatars/duelist-left.svg';
      return '/avatars/duelist-right.svg';
    },
    maxHp(side) {
      const hero = side === 'left' ? this.leftHero : this.rightHero;
      if (!hero) return 1;
      return hero.primary.tili * 10;
    },
    finalHp(side) {
      if (!this.result) return 0;
      return side === 'left' ? this.currentLeftHp : this.currentRightHp;
    },
    finalHpPercent(side) {
      const hp = this.finalHp(side);
      const max = this.maxHp(side);
      return Math.max(0, Math.min(100, Math.round((hp / max) * 100)));
    },
    hpPercent(current, max) {
      if (!max || max <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
    },
  },
  mounted() {
    this.bootstrap();
  },
  beforeUnmount() {
    this.stopPlayback();
    this.clearStageFx();
  },
}).mount('#app');
