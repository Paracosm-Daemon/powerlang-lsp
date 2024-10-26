"use strict";
// #region Types
export type PowerlangParameter = {
	name: string;
	type: string;

	default?: string;
};
export type PowerlangAPI = {
	parameters: PowerlangParameter[];
	return: string[];

	description?: string;
	name: string;
};
export type PowerlangGlobal = {
	api: PowerlangAPI[];
	name: string,
};
// #endregion