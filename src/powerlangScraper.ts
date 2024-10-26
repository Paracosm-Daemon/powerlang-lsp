"use strict";
// #region Imports
import * as html from "node-html-parser";
import * as vscode from "vscode";
import * as fs from "fs";
// #endregion
// #region Modules
import { PowerlangAPI, PowerlangGlobal, PowerlangParameter } from "./powerlangAPI";
import { PowerlangProvider } from "./powerlangProvider";

import { PowerlangHandle, RegeneratedEventParams, FILE_ENCODING } from "./powerlangHandle";
// #endregion
// #region Types
type scrapeLink = {
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
// TODO: Scrape for instance and global functions
const BLACKLISTED_LABELS: string[] = [ "Name", "Function", "Description" ];

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
		}, async (progress: vscode.Progress<{ message?: string, increment?: number; }>, token: vscode.CancellationToken): Promise<RegeneratedEventParams | undefined> =>
		{
			return new Promise(async (resolve: (value: RegeneratedEventParams | undefined) => void, reject: (reason?: any) => void): Promise<void> =>
			{
				token.onCancellationRequested((): void => resolve(undefined));
				try
				{
					const benchmarkStart: number = Date.now();
					progress.report({ increment: 0 });

					const libraryReferences: PowerlangGlobal[] = [];
					const globalReferences: PowerlangAPI[] = [];
					// #region Library
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
						const scrapingLinks: scrapeLink[] = [];

						listBody.getElementsByTagName("A").forEach((link: html.HTMLElement): void =>
						{
							const href: string | undefined = link.getAttribute("href")?.trim();
							// Filter it to make sure it's a valid reference
							if (href === undefined
								|| !href.startsWith(BASE_SCRAPE)
								|| href.endsWith("/special-types") // Title, disregard
								|| href.endsWith("/services")) // Title, disregard
								return;
							scrapingLinks.push({
								library: link.text,
								reference: href
							});
						});

						const linksToScrape: number = scrapingLinks.length;
						if (linksToScrape === 0) break;

						const progressScrapeIncrement: number = (POST_LIBRARY_PERCENTAGE - PRE_LIBRARY_INCREMENT) / linksToScrape;
						for (let scrapeIndex: number = 0; scrapeIndex < linksToScrape; scrapeIndex++)
						{
							if (token.isCancellationRequested)
								return;

							const currentLink: scrapeLink = scrapingLinks[ scrapeIndex ];
							const libraryName: string = currentLink.library;

							console.log("Scrape library", libraryName);
							progress.report({
								message: `Scraping ${libraryName}`,
								increment: progressScrapeIncrement
							});
							// We then scrape another part of the site for all of its info!
							const hrefResponse: Response = await fetch(API_ORIGIN + currentLink.reference, API_REQUEST_OPTIONS);
							if (!hrefResponse.ok) throw new Error(`Error ${hrefResponse.status} (${hrefResponse.statusText})`);

							const referenceHTML: string = await hrefResponse.text();
							const referenceDocument: html.HTMLElement = html.parse(referenceHTML);

							const referenceBody: html.HTMLElement | null = referenceDocument.querySelector("body");
							if (referenceBody === null)
							{
								reject(`${libraryName} document malformed, missing elements`);
								return;
							}

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
							{
								reject(`${libraryName} has a malformed API table, uneven item count`);
								return;
							}

							const libraryAPI: PowerlangAPI[] = [];
							for (let itemIndex: number = 0; itemIndex < itemCount; itemIndex += 2)
							{
								// Grab the function's description and definition
								const functionDescription: string = tableItems[ 1 + itemIndex ];
								const functionDefinition: string = tableItems[ itemIndex ];
								// First, get the name of the function
								const functionParametersStart: number = functionDefinition.indexOf("(");
								if (functionParametersStart < 0)
								{
									reject(`${libraryName} has an invalid function definition: ${functionDefinition}`);
									return;
								}

								const functionName: string = functionDefinition.substring(0, functionParametersStart);
								// Then, check for its parameters
								const functionAfterName: string = functionDefinition.slice(functionParametersStart);
								const functionParameters: RegExpExecArray | null = REGEX_PARAMETERS.exec(functionAfterName);
								// This will not throw an exception if there are no parameters!
								// This is sort of like a double check for if the parenthesis close
								if (functionParameters === null)
								{
									reject(`${libraryName} has an invalid function (${functionName})`);
									return;
								}

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
							libraryReferences.push({
								name: libraryName,
								api: libraryAPI
							});
						}
						break;
					}
					// #endregion
					if (token.isCancellationRequested)
						return;
					// #region Globals
					progress.report({
						message: "Scraping globals",
						increment: PRE_GLOBALS_INCREMENT
					});

					const globalsResponse: Response = await fetch(API_ORIGIN + GLOBAL_SCRAPE, API_REQUEST_OPTIONS);
					if (!globalsResponse.ok) throw new Error(`Error ${globalsResponse.status} (${globalsResponse.statusText})`);
					// Pretty much copy and pasted, I might find a way to make this less copy-pastey later on
					const globalsHTML: string = await globalsResponse.text();
					const globalsDocument: html.HTMLElement = html.parse(globalsHTML);

					const globalsBody: html.HTMLElement | null = globalsDocument.querySelector("body");
					if (globalsBody === null)
					{
						reject("Global functions document malformed!");
						return;
					}

					const globalItems: string[] = [];
					globalsBody.getElementsByTagName("DIV").forEach((divElement: html.HTMLElement, index): void =>
					{
						const divLabel: string = divElement.text;
						if (BLACKLISTED_LABELS.includes(divLabel)) return;

						const divChildren: html.HTMLElement[] = divElement.getElementsByTagName("P");
						if (divChildren.length === 0
							|| divElement.id !== ""
							|| divElement.getAttribute("class") !== CLASS_TABLE)
							return;
						for (const divChild of divChildren)
						{
							if (divChild.getAttribute("class") !== CLASS_PARAGRAPH)
								return;
						}
						globalItems.push(divLabel);
					});

					const globalCount: number = globalItems.length;
					if ((globalCount % 2) !== 0)
					{
						reject("Globals have a malformed API table, uneven item count");
						return;
					}

					for (let itemIndex: number = 0; itemIndex < globalCount; itemIndex += 2)
					{
						// Grab the function's description and definition
						const functionDescription: string = globalItems[ 1 + itemIndex ];
						const functionDefinition: string = globalItems[ itemIndex ];
						// First, get the name of the function
						const functionParametersStart: number = functionDefinition.indexOf("(");
						if (functionParametersStart < 0)
						{
							reject(`Globals have an invalid function definition: ${functionDefinition}`);
							return;
						}

						const functionName: string = functionDefinition.substring(0, functionParametersStart);
						// Then, check for its parameters
						const functionAfterName: string = functionDefinition.slice(functionParametersStart);
						const functionParameters: RegExpExecArray | null = REGEX_PARAMETERS.exec(functionAfterName);
						// This will not throw an exception if there are no parameters!
						// This is sort of like a double check for if the parenthesis close
						if (functionParameters === null)
						{
							reject(`Globals have an invalid function (${functionName})`);
							return;
						}

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
						globalReferences.push({
							description: functionDescription,
							name: functionName,

							parameters: parametersList,
							return: argumentsList
						});
					}
					console.log("Scrape globals", globalReferences);
					// #endregion
					if (token.isCancellationRequested)
						return;
					// #region Write
					progress.report({
						message: "Writing to resource files",
						increment: PRE_WRITE_INCREMENT
					});
					// First, open the files
					const librariesFile: number = fs.openSync(this.handle.getResourcePath("libraries.json"), "w");
					const globalsFile: number = fs.openSync(this.handle.getResourcePath("globals.json"), "w");
					// Then, write the JSON encoded version of the references
					fs.writeFileSync(librariesFile, JSON.stringify(libraryReferences), FILE_ENCODING);
					fs.writeFileSync(globalsFile, JSON.stringify(globalReferences), FILE_ENCODING);
					// Finally, close the files
					fs.closeSync(librariesFile);
					fs.closeSync(globalsFile);
					// End with a benchmark and resolve as successful
					const benchmarkEnd: number = Date.now();
					this.handle.showInformationMessage(`Done regenerating globals! Took ${benchmarkEnd - benchmarkStart}ms`);

					resolve({
						libraries: libraryReferences,
						globals: globalReferences
					});
					// #endregion
				}
				catch (exception: any)
				{
					reject(exception);
				}
			}).catch((reason?: any): undefined =>
			{
				const prettyReason: string = reason instanceof Error
					? reason.message
					: reason.toString();

				this.handle.showErrorMessage(`Failed to regenerate globals: ${prettyReason}`);
				return undefined;
			});
		}).then((result: RegeneratedEventParams | undefined): void =>
		{
			if (result !== undefined)
			{
				console.log("Globals scraped and written to file", result);
				this.handle.globalsRegeneratedEmitter.fire(result);
			}
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