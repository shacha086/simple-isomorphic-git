// noinspection JSUnusedLocalSymbols

import {SimpleGit, SimpleGitFactory} from 'simple-git/dist/typings';
import {SimpleIsomorphicGit} from "./simpleIsomorphicGit";
import * as types from "simple-git/dist/typings/types";

const SimpleIsomorphicGitFactoryImpl: SimpleGitFactory = (
    baseDirOrOptions?: string | Partial<types.SimpleGitOptions>,
    maybeOptions?: Partial<types.SimpleGitOptions>
): SimpleGit => {
    let baseDir: string | undefined;
    let options: Partial<types.SimpleGitOptions> | undefined;

    if (typeof baseDirOrOptions === 'string') {
        baseDir = baseDirOrOptions;
        options = maybeOptions;
    } else {
        options = baseDirOrOptions;
    }

    return new SimpleIsomorphicGit({dir: baseDir ?? options?.baseDir});
};


export const simpleIsomorphicGit: SimpleGitFactory = SimpleIsomorphicGitFactoryImpl;
export default SimpleIsomorphicGitFactoryImpl;