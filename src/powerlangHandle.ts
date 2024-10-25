"use strict";
// #region Imports
import * as vscode from "vscode";

import { PowerlangCompletionProvider } from "./completionProvider";
import { PowerlangScraper } from "./scraper/powerlangScraper";
import { PowerlangParser } from "./parser/powerlangParser";
import { PowerlangColorProvider } from "./colorProvider";
// #endregion
// #region Classes
export class PowerlangHandle
{
	// #region Functions
	// #region Public
	public constructor(public readonly context: vscode.ExtensionContext)
	{
		new PowerlangParser(this);
		new PowerlangScraper(this);

		new PowerlangCompletionProvider(this);
		new PowerlangColorProvider(this);
	}
	// #endregion
	// #endregion
}
// #endregion