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
    };
  },
  computed: {
    leftHero() {
      return this.heroes.find((h) => h.id === this.leftHeroId) || null;
    },
    rightHero() {
      return this.heroes.find((h) => h.id === this.rightHeroId) || null;
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
        this.result = await response.json();
      } finally {
        this.loading = false;
      }
    },
    maxHp(side) {
      const hero = side === 'left' ? this.leftHero : this.rightHero;
      if (!hero) return 1;
      return hero.primary.tili * 10;
    },
    finalHp(side) {
      if (!this.result || !this.result.logs.length) return 0;
      const last = this.result.logs[this.result.logs.length - 1];
      return side === 'left' ? last.leftHp : last.rightHp;
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
}).mount('#app');
