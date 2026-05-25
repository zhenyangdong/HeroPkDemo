package com.knownedge.heropk.model;

public class PrimaryStats {
	private int tili;
	private int wuli;
	private int fangyu;
	private int neili;

	public PrimaryStats() {
	}

	public PrimaryStats(int tili, int wuli, int fangyu, int neili) {
		this.tili = tili;
		this.wuli = wuli;
		this.fangyu = fangyu;
		this.neili = neili;
	}

	public int getTili() {
		return tili;
	}

	public int getWuli() {
		return wuli;
	}

	public int getFangyu() {
		return fangyu;
	}

	public int getNeili() {
		return neili;
	}
}
