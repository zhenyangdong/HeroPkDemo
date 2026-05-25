package com.knownedge.heropk.model;

public class BattleRequest {
    private String leftHeroId;
    private String rightHeroId;
    private Integer maxRounds;
    private Long seed;

    public String getLeftHeroId() { return leftHeroId; }
    public void setLeftHeroId(String leftHeroId) { this.leftHeroId = leftHeroId; }
    public String getRightHeroId() { return rightHeroId; }
    public void setRightHeroId(String rightHeroId) { this.rightHeroId = rightHeroId; }
    public Integer getMaxRounds() { return maxRounds; }
    public void setMaxRounds(Integer maxRounds) { this.maxRounds = maxRounds; }
    public Long getSeed() { return seed; }
    public void setSeed(Long seed) { this.seed = seed; }
}
