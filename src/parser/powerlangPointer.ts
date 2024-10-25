"use strict";
// #region Classes
export class PowerlangPointer
{
	// #region Variables
	public readonly lineBreaks: number;
	public pointerIndex: number;
	// #endregion
	// #region Functions
	public constructor(public readonly source: string)
	{
		this.lineBreaks = source.split("\n").length;
		this.pointerIndex = 0;
	}

	public getPointedCharacter(): string { return this.source[ this.pointerIndex ]; }
	public increment(delta: number = 1): void { this.pointerIndex += delta; }
	// #endregion
}
// #endregion