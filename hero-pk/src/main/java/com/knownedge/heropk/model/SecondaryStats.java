package com.knownedge.heropk.model;

public class SecondaryStats {
        private double critRate;
        private double critDamageRate;
        private double hitRate;
        private double dodgeRate;
        private double blockRate;
        private double blockDamage;
        private double comboRate;
        private double heavyRate;

        public SecondaryStats() {
        }

        public SecondaryStats(double critRate, double critDamageRate, double hitRate,
                                                  double dodgeRate, double blockRate, double blockDamage) {
                this.critRate = critRate;
                this.critDamageRate = critDamageRate;
                this.hitRate = hitRate;
                this.dodgeRate = dodgeRate;
                this.blockRate = blockRate;
                this.blockDamage = blockDamage;
                this.comboRate = 0.0;
                this.heavyRate = 0.0;
        }

        public SecondaryStats(double critRate, double critDamageRate, double hitRate,
                                                  double dodgeRate, double blockRate, double blockDamage,
                                                  double comboRate, double heavyRate) {
                this.critRate = critRate;
                this.critDamageRate = critDamageRate;
                this.hitRate = hitRate;
                this.dodgeRate = dodgeRate;
                this.blockRate = blockRate;
                this.blockDamage = blockDamage;
                this.comboRate = comboRate;
                this.heavyRate = heavyRate;
        }

        public double getCritRate() {
                return critRate;
        }

        public double getCritDamageRate() {
                return critDamageRate;
        }

        public double getHitRate() {
                return hitRate;
        }

        public double getDodgeRate() {
                return dodgeRate;
        }

        public double getBlockRate() {
                return blockRate;
        }

        public double getBlockDamage() {
                return blockDamage;
        }

        public double getComboRate() {
                return comboRate;
        }

        public double getHeavyRate() {
                return heavyRate;
        }
}
