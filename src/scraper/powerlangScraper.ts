"use strict";
// #region Imports
import * as vscode from "vscode";

import { PowerlangProvider } from "../powerlangProvider";
import { PowerlangHandle } from "../powerlangHandle";
// #endregion
// #region Classes
export class PowerlangScraper extends PowerlangProvider
{
	// #region Functions
	// #region Overrides
	public constructor(handle: PowerlangHandle)
	{
		super(handle);
		this._registerEvents();
	}
	// #endregion
	// #region Private
	private _registerEvents(): void
	{
		vscode.commands.registerCommand("powerlang.regenerateGlobals", (): void =>
		{
			console.log("TODO: Make this command work");
		});
	}
	// #endregion
	// #endregion
}
// #endregion