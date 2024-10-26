"use strict";
// #region Imports
import * as html from "node-html-parser";
import * as vscode from "vscode";
import * as fs from "fs";
// #endregion
// #region Modules
import { PowerlangAPI, PowerlangGlobal, PowerlangParameter } from "./powerlangAPI";
import { PowerlangProvider } from "./powerlangProvider";

import { PowerlangHandle, FILE_ENCODING, GLOBALS_RESOURCE_NAME, LIBRARY_RESOURCE_NAME, LIBRARY_COLORING_RESOURCE_NAME } from "./powerlangHandle";
// #endregion
// #region Types
type ScrapeLink = {
	reference: string;
	library: string;
};
// #endregion
// #region Constants
const API_ORIGIN: string = "https://vopwn55.gitbook.io";
const API_REQUEST_OPTIONS: RequestInit = {
	method: "GET",
	headers: {
		"Accept-Encoding": "gzip, deflate, br, zstd",
		"Accept-Language": "en-US",
		"Accept": "text/html",

		"Cookie": "__gitbook_cookie_granted=no"
	}
};
// TODO: Scrape for instance functions
const BLACKLISTED_LABELS: string[] = [ "Name", "Function", "Description" ];
const TAG_RESTART: string = "Restart VSCode";

const CLASS_PARAGRAPH: string = "mx-auto decoration-primary/6 w-full max-w-[unset]";
const CLASS_TABLE: string = "w-full space-y-2 lg:space-y-3 leading-normal";

const GLOBAL_SCRAPE: string = "/powerlang-docs/advanced-information/global-functions";
const BASE_SCRAPE: string = "/powerlang-docs/libraries/";

const POST_LIBRARY_PERCENTAGE: number = 70;
const PRE_LIBRARY_INCREMENT: number = 10;

const PRE_GLOBALS_INCREMENT: number = 10;
const PRE_WRITE_INCREMENT: number = 100 - (PRE_LIBRARY_INCREMENT + POST_LIBRARY_PERCENTAGE + PRE_GLOBALS_INCREMENT);

const REGEX_PARAMETERS: RegExp = /\(([^)]*)\)/;
const REGEX_RETURNING: RegExp = /->\s*(.*)/;
// #endregion
// #region Classes
export class PowerlangScraper extends PowerlangProvider
{
	// #region Variables
	private _isRegenerating: boolean;
	// #endregion
	// #endregion
	// #region Functions
	// #region Overrides
	public constructor(handle: PowerlangHandle)
	{
		super(handle);

		this._isRegenerating = false;
		this._registerEvents();
	}
	// #endregion
	// #region Private
	private async _scrapeFunctions(link: ScrapeLink): Promise<PowerlangAPI[]>
	{
		const hrefResponse: Response = await fetch(link.reference, API_REQUEST_OPTIONS);
		const libraryName: string = link.library;

		if (!hrefResponse.ok) throw new Error(`Error ${hrefResponse.status} (${hrefResponse.statusText})`);

		const referenceHTML: string = await hrefResponse.text();
		const referenceDocument: html.HTMLElement = html.parse(referenceHTML);

		const referenceBody: html.HTMLElement | null = referenceDocument.querySelector("body");
		if (referenceBody === null)
			throw new Error(`${libraryName} document malformed, missing body`);

		const tableItems: string[] = [];
		referenceBody.getElementsByTagName("DIV").forEach((divElement: html.HTMLElement, index): void =>
		{
			const divLabel: string = divElement.text;
			if (BLACKLISTED_LABELS.includes(divLabel)) return;

			const divChildren: html.HTMLElement[] = divElement.getElementsByTagName("P");
			if (divChildren.length === 0
				|| divElement.id !== ""
				|| divElement.getAttribute("class") !== CLASS_TABLE) // Table class
				return;
			for (const divChild of divChildren)
			{
				if (divChild.getAttribute("class") !== CLASS_PARAGRAPH) // P class
					return;
			}
			tableItems.push(divLabel);
		});

		const itemCount: number = tableItems.length;
		if ((itemCount % 2) !== 0)
			throw new Error(`${libraryName} has a malformed API table, uneven item count`);

		const libraryAPI: PowerlangAPI[] = [];
		for (let itemIndex: number = 0; itemIndex < itemCount; itemIndex += 2)
		{
			// Grab the function's description and definition
			const functionDescription: string = tableItems[ 1 + itemIndex ];
			const functionDefinition: string = tableItems[ itemIndex ];
			// First, get the name of the function
			const functionParametersStart: number = functionDefinition.indexOf("(");
			if (functionParametersStart < 0)
				throw new Error(`${libraryName} has an invalid function definition: ${functionDefinition}`);

			const functionName: string = functionDefinition.substring(0, functionParametersStart);
			// Then, check for its parameters
			const functionAfterName: string = functionDefinition.slice(functionParametersStart);
			const functionParameters: RegExpExecArray | null = REGEX_PARAMETERS.exec(functionAfterName);
			// This will not throw an exception if there are no parameters!
			// This is sort of like a double check for if the parenthesis close
			if (functionParameters === null)
				throw new Error(`${libraryName} has an invalid function: ${functionName}`);

			const parametersExtracted: string = functionParameters[ 1 ];
			const parametersList: PowerlangParameter[] = [];
			// Extract the RegEx filtered params
			if (parametersExtracted.length !== 0)
			{
				parametersExtracted.split(",").forEach((parameterArgument: string): void =>
				{
					const defaultAssignmentIndex: number = parameterArgument.indexOf("=");
					const typeAnnotationIndex: number = parameterArgument.indexOf(":");

					const isAnnotated: boolean = typeAnnotationIndex >= 0;

					const parameterName: string = (isAnnotated ? parameterArgument.substring(0, typeAnnotationIndex) : parameterArgument).trimStart();
					const parameterType: string = isAnnotated ? parameterArgument.slice(1 + typeAnnotationIndex).trimStart() : "any";

					if (defaultAssignmentIndex < 0)
					{
						parametersList.push({
							name: parameterName,
							type: parameterType
						});
					}
					else
					{
						// This should hopefully account for variables that don't have their types defined
						// Check if the specified default is assigned after the type annotation
						const isDefaultAfterAnnotation: boolean = isAnnotated && defaultAssignmentIndex > typeAnnotationIndex;
						parametersList.push({
							type: isDefaultAfterAnnotation ? parameterArgument.substring(1 + typeAnnotationIndex, defaultAssignmentIndex).trimEnd() : parameterType,
							name: isDefaultAfterAnnotation ? parameterName : parameterArgument.substring(0, defaultAssignmentIndex).trimEnd(),

							default: parameterArgument.slice(1 + defaultAssignmentIndex).trimStart()
						});
					}
				});
			}
			// Then, look for the returned arguments
			const returnMatched: RegExpExecArray | null = REGEX_RETURNING.exec(functionAfterName.slice(functionParameters[ 0 ].length));
			const returnArguments: string | undefined = returnMatched?.[ 1 ];

			const argumentsList: string[] = [];
			// These are optional as functions that don't return are still valid
			if (returnArguments !== undefined && returnArguments.length !== 0)
				argumentsList.push(...returnArguments.split(",").map((returnArgument: string): string => returnArgument.trim()));
			// Finally, construct this function in the API for this library
			libraryAPI.push({
				description: functionDescription,
				name: functionName,

				parameters: parametersList,
				return: argumentsList
			});
		}
		// After the entire API is constructed, push the library
		return libraryAPI;
	}
	private _regenerateGlobals(...args: any[]): void
	{
		if (this._isRegenerating)
		{
			this.handle.showWarningMessage("Globals are currently being regenerated");
			return;
		}

		this._isRegenerating = true;
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Fetching API",
			cancellable: true
		}, async (progress: vscode.Progress<{ message?: string, increment?: number; }>, token: vscode.CancellationToken): Promise<boolean> =>
		{
			return new Promise(async (resolve: (value: boolean) => void, reject: (reason?: any) => void): Promise<void> =>
			{
				token.onCancellationRequested((): void => resolve(false));
				try
				{
					const benchmarkStart: number = Date.now();
					progress.report({ increment: 0 });
					// #region Library
					const libraryReferences: PowerlangGlobal[] = [];
					const libraryNames: string[] = [];
					// Fetch to the original endpoint first to grab all of the valid libraries
					const apiResponse: Response = await fetch(API_ORIGIN + BASE_SCRAPE, API_REQUEST_OPTIONS);

					if (!apiResponse.ok) throw new Error(`Error ${apiResponse.status} (${apiResponse.statusText})`);
					if (token.isCancellationRequested)
						return;

					progress.report({ increment: PRE_LIBRARY_INCREMENT, message: "Scraping libraries" });
					// Parse the HTML document
					const documentHTML: string = await apiResponse.text();
					const apiDocument: html.HTMLElement = html.parse(documentHTML);

					const mainBody: html.HTMLElement | null = apiDocument.querySelector("body");
					if (mainBody === null)
					{
						reject("HTML document malformed, missing elements");
						return;
					}
					// API is on a sidebar, and only available there
					const asideElements: html.HTMLElement[] = mainBody.getElementsByTagName("ASIDE");
					for (const element of asideElements)
					{
						// All links are under an unordered list
						const listBodies: html.HTMLElement[] = element.getElementsByTagName("UL");
						if (listBodies.length === 0)
							continue;
						// Search for hrefs under the first list
						const listBody: html.HTMLElement = listBodies[ 0 ];
						const scrapingLinks: ScrapeLink[] = [];

						listBody.getElementsByTagName("A").forEach((link: html.HTMLElement): void =>
						{
							const href: string | undefined = link.getAttribute("href")?.trim();
							// Filter it to make sure it's a valid reference
							if (href === undefined
								|| !href.startsWith(BASE_SCRAPE)
								|| href.endsWith("/special-types") // Title, disregard
								|| href.endsWith("/services")) // Title, disregard
								return;

							const libraryName: string = link.text;
							scrapingLinks.push({
								reference: API_ORIGIN + href,
								library: libraryName
							});
							libraryNames.push(libraryName);
						});

						const linksToScrape: number = scrapingLinks.length;
						if (linksToScrape === 0) break;

						const progressScrapeIncrement: number = (POST_LIBRARY_PERCENTAGE - PRE_LIBRARY_INCREMENT) / linksToScrape;
						for (let scrapeIndex: number = 0; scrapeIndex < linksToScrape; scrapeIndex++)
						{
							const currentLink: ScrapeLink = scrapingLinks[ scrapeIndex ];
							const libraryName: string = currentLink.library;

							console.log("Scrape library", libraryName);
							progress.report({
								message: `Scraping ${libraryName}`,
								increment: progressScrapeIncrement
							});
							// We then scrape another part of the site for all of its info!
							// After the entire API is constructed, push the library
							libraryReferences.push({
								api: await this._scrapeFunctions(currentLink),
								name: libraryName
							});
							if (token.isCancellationRequested)
								return;
						}
						break;
					}
					// #endregion
					// #region Globals
					progress.report({
						message: "Scraping global functions",
						increment: PRE_GLOBALS_INCREMENT
					});

					const globalReferences: PowerlangAPI[] = await this._scrapeFunctions({
						reference: API_ORIGIN + GLOBAL_SCRAPE,
						library: "Globals"
					});

					console.log("Scraped globals", globalReferences);
					if (token.isCancellationRequested)
						return;
					// #endregion
					// #region Write
					progress.report({
						message: "Writing to resource files",
						increment: PRE_WRITE_INCREMENT
					});
					// First, open the files
					const coloringFile: number = fs.openSync(this.handle.getResourcePath(LIBRARY_COLORING_RESOURCE_NAME), "w");
					const librariesFile: number = fs.openSync(this.handle.getResourcePath(LIBRARY_RESOURCE_NAME), "w");
					const globalsFile: number = fs.openSync(this.handle.getResourcePath(GLOBALS_RESOURCE_NAME), "w");
					// Then, encode the libraryItems into a format that can be read in the libraryColoring file
					const regexNames: string = `\\b(${libraryNames.join("|")})\\b`;
					const coloringContent: string = JSON.stringify({
						"$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
						"scopeName": "source.libraries.powerlang",
						"patterns": [
							{
								"include": "#libraries"
							}
						],
						"repository": {
							"libraries": {
								"patterns": [
									{
										"name": "support.class.powerlang",
										"match": regexNames
									}
								]
							}
						}
					});
					console.log(coloringContent);
					// Write the JSON encoded version of the references to their respective files
					fs.writeFileSync(librariesFile, JSON.stringify(libraryReferences), FILE_ENCODING);
					fs.writeFileSync(globalsFile, JSON.stringify(globalReferences), FILE_ENCODING);
					fs.writeFileSync(coloringFile, coloringContent, FILE_ENCODING);
					// Finally, close the files
					fs.closeSync(librariesFile);
					fs.closeSync(coloringFile);
					fs.closeSync(globalsFile);
					// End with a benchmark and resolve as successful
					const benchmarkEnd: number = Date.now();
					this.handle.showInformationMessage(
						`Regenerated (took ${benchmarkEnd - benchmarkStart}ms). Reload the editor to update the syntax highlighting.`,
						TAG_RESTART
					).then((tag: string | undefined): void =>
					{
						if (tag === TAG_RESTART)
							vscode.commands.executeCommand("workbench.action.reloadWindow");
					});

					this.handle.loadGlobals(libraryReferences, globalReferences);
					resolve(true);
					// #endregion
				}
				catch (exception: any)
				{
					reject(exception);
				}
			}).catch((reason?: any): boolean =>
			{
				const prettyReason: string = reason instanceof Error
					? reason.message
					: reason.toString();

				this.handle.showErrorMessage(`Failed to regenerate globals: ${prettyReason}`);
				return false;
			});
		}).then((success: boolean): void =>
		{
			if (success === true)
				console.log("Globals scraped and written to files");
			this._isRegenerating = false;
		});
	}
	private _registerEvents(): void
	{
		vscode.commands.registerCommand("powerlang.regenerateGlobals", this._regenerateGlobals, this);
	}
	// #endregion
	// #endregion
}
// #endregion