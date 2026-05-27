package com.knownedge.heropk.model;

public class BalanceRuntimeState {
    private boolean burstWindowActive;
    private int burstWindowRoundsLeft;
    private String burstTriggerReason;
    private boolean underdogBoostActive;

    public boolean isBurstWindowActive() {
        return burstWindowActive;
    }

    public void setBurstWindowActive(boolean burstWindowActive) {
        this.burstWindowActive = burstWindowActive;
    }

    public int getBurstWindowRoundsLeft() {
        return burstWindowRoundsLeft;
    }

    public void setBurstWindowRoundsLeft(int burstWindowRoundsLeft) {
        this.burstWindowRoundsLeft = burstWindowRoundsLeft;
    }

    public String getBurstTriggerReason() {
        return burstTriggerReason;
    }

    public void setBurstTriggerReason(String burstTriggerReason) {
        this.burstTriggerReason = burstTriggerReason;
    }

    public boolean isUnderdogBoostActive() {
        return underdogBoostActive;
    }

    public void setUnderdogBoostActive(boolean underdogBoostActive) {
        this.underdogBoostActive = underdogBoostActive;
    }
}
