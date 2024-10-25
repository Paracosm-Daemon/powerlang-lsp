"use strict";
// #region Imports
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

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
	private _regenerateGlobals(): void
	{
		console.log("TODO: Make this command work", this);

		const resourcesPath: string = this.handle.context.extensionPath + path.sep + "resources";
		console.log(fs.existsSync(resourcesPath));

		this.handle.showErrorMessage("Resources path doesn't exist");
	}
	private _registerEvents(): void
	{
		vscode.commands.registerCommand("powerlang.regenerateGlobals", this._regenerateGlobals, this);
	}
	// #endregion
	// #endregion
}
// #endregion