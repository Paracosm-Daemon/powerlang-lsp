"use strict";
// #region Imports
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import { PowerlangProvider } from "./powerlangProvider";
import { PowerlangHandle } from "./powerlangHandle";
// #endregion
// #region Constants
const API_ENDPOINT: string = "https://vopwn55.gitbook.io/powerlang-docs/";
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
	private _regenerateGlobals(...args: any[]): void
	{
		const resourcesPath: string = this.handle.context.extensionPath + path.sep + "resources" + path.sep;
		if (!fs.existsSync(resourcesPath))
		{
			this.handle.showErrorMessage(`Path to scrape destination doesn't exist: ${resourcesPath}`);
			return;
		}
		console.log("Scrape to", resourcesPath, ...args);
	}
	private _registerEvents(): void
	{
		vscode.commands.registerCommand("powerlang.regenerateGlobals", this._regenerateGlobals, this);
	}
	// #endregion
	// #endregion
}
// #endregion