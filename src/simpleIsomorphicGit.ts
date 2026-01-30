import type {
    ApplyOptions,
    BranchMultiDeleteResult,
    BranchSingleDeleteResult,
    BranchSummary,
    CheckRepoActions,
    CleanMode,
    CleanOptions,
    CleanSummary,
    CommitResult,
    ConfigGetResult,
    ConfigListSummary,
    CountObjectsResult,
    DefaultLogFields,
    DiffResult,
    GitConfigScope,
    GitError,
    GitGrepQuery,
    GrepResult,
    InitResult,
    LogResult,
    MoveSummary,
    Options,
    PullResult,
    RemoteWithoutRefs,
    RemoteWithRefs,
    Response,
    SimpleGit,
    SimpleGitOptions,
    SimpleGitTaskCallback,
    StatusResult,
    TagResult,
    TaskOptions,
    VersionResult,
    FetchResult,
    MergeResult,
    PushResult,
    LogOptions, StatusResultRenamed
} from "simple-git";

import fs from "fs";
import git, { FsClient } from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import * as isomorphic from 'isomorphic-git'
function handleCallback<T>(promise: Promise<T>, callback?: SimpleGitTaskCallback<T>): Response<T> {
    if (callback) {
        promise.then(
            result => callback(null, result),
            error => callback(error, undefined as unknown as T)
        );
    }
    return promise as Response<T>;
}

function isCallback<T>(arg: any): arg is SimpleGitTaskCallback<T> {
    return typeof arg === 'function';
}

export interface SimpleIsomorphicGitOptions {
    fs?: FsClient;
    dir?: string;
    http?: typeof http;
    author?: { name: string; email: string };
}

type OutputHandler = (
    command: string,
    stdout: NodeJS.ReadableStream,
    stderr: NodeJS.ReadableStream,
    args: string[]
) => void;

export class SimpleIsomorphicGit implements SimpleGit {
    private _fs: FsClient;
    private _dir: string;
    private _http: typeof http;
    private _author: { name: string; email: string };
    private _env: Record<string, string> = {};

    constructor(options: SimpleIsomorphicGitOptions = {}) {
        this._fs = options.fs || fs;
        this._dir = options.dir || process.cwd();
        this._http = options.http || http;
        this._author = options.author || { name: 'Unknown', email: 'unknown@example.com' };
    }

    add(files: string | string[], callback?: SimpleGitTaskCallback<string>): Response<string> {
        const fileList = Array.isArray(files) ? files : [files];
        const promise = (async () => {
            for (const filepath of fileList) {
                await git.add({
                    fs: this._fs,
                    dir: this._dir,
                    filepath
                });
            }
            return fileList.join(', ');
        })();
        return handleCallback(promise, callback);
    }

    addAnnotatedTag(tagName: string, tagMessage: string, callback?: SimpleGitTaskCallback<{ name: string }>): Response<{ name: string }> {
        const promise = (async () => {
            await git.annotatedTag({
                fs: this._fs,
                dir: this._dir,
                ref: tagName,
                message: tagMessage,
                tagger: {
                    name: this._author.name,
                    email: this._author.email
                }
            });
            return { name: tagName };
        })();
        return handleCallback(promise, callback);
    }

    addConfig(key: string, value: string, append?: boolean, scope?: keyof typeof GitConfigScope, callback?: SimpleGitTaskCallback<string>): Response<string>;
    addConfig(key: string, value: string, append?: boolean, callback?: SimpleGitTaskCallback<string>): Response<string>;
    addConfig(key: string, value: string, callback?: SimpleGitTaskCallback<string>): Response<string>;
    addConfig(key: string, value: string, append?: boolean | SimpleGitTaskCallback<string>, scope?: "system" | "global" | "local" | "worktree" | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(append) ? append : isCallback(scope) ? scope : callback;
        const promise = (async () => {
            await git.setConfig({
                fs: this._fs,
                dir: this._dir,
                path: key,
                value
            });
            return '';
        })();
        return handleCallback(promise, cb);
    }

    addRemote(remoteName: string, remoteRepo: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    addRemote(remoteName: string, remoteRepo: string, callback?: SimpleGitTaskCallback<string>): Response<string>;
    addRemote(remoteName: string, remoteRepo: string, options?: TaskOptions | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(options) ? options : callback;
        const promise = (async () => {
            await git.addRemote({
                fs: this._fs,
                dir: this._dir,
                remote: remoteName,
                url: remoteRepo
            });
            return '';
        })();
        return handleCallback(promise, cb);
    }

    addTag(name: string, callback?: SimpleGitTaskCallback<{ name: string }>): Response<{ name: string }> {
        const promise = (async () => {
            await git.tag({
                fs: this._fs,
                dir: this._dir,
                ref: name
            });
            return { name };
        })();
        return handleCallback(promise, callback);
    }

    applyPatch(patches: string | string[], options: TaskOptions<ApplyOptions>, callback?: SimpleGitTaskCallback<string>): Response<string>;
    applyPatch(patches: string | string[], callback?: SimpleGitTaskCallback<string>): Response<string>;
    applyPatch(_patches: string | string[], options?: TaskOptions<ApplyOptions> | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(options) ? options : callback;
        return handleCallback(Promise.reject(new Error("applyPatch is not supported by isomorphic-git")), cb);
    }

    binaryCatFile(options: string[], callback?: SimpleGitTaskCallback<any>): Response<any> {
        const promise = (async () => {
            if (options.length < 1) throw new Error("Invalid options");
            const oid = options[0];
            const { blob } = await git.readBlob({
                fs: this._fs,
                dir: this._dir,
                oid
            });
            return Buffer.from(blob);
        })();
        return handleCallback(promise, callback);
    }

    branch(options?: TaskOptions, callback?: SimpleGitTaskCallback<BranchSummary>): Response<BranchSummary> {
        const cb = isCallback(options) ? options : callback;
        const promise = (async () => {
            const branches = await git.listBranches({
                fs: this._fs,
                dir: this._dir
            });
            const currentBranch = await git.currentBranch({
                fs: this._fs,
                dir: this._dir
            });

            const all: string[] = [];
            const branchesObj: BranchSummary['branches'] = {};

            for (const branch of branches) {
                all.push(branch);
                const commit = await git.resolveRef({
                    fs: this._fs,
                    dir: this._dir,
                    ref: branch
                });
                branchesObj[branch] = {
                    current: branch === currentBranch,
                    name: branch,
                    commit: commit.slice(0, 7),
                    label: branch,
                    linkedWorkTree: false
                };
            }

            return {
                detached: !currentBranch,
                current: currentBranch || '',
                all,
                branches: branchesObj
            } as BranchSummary;
        })();
        return handleCallback(promise, cb);
    }

    branchLocal(callback?: SimpleGitTaskCallback<BranchSummary>): Response<BranchSummary> {
        return this.branch(undefined, callback);
    }

    catFile(options: string[], callback?: SimpleGitTaskCallback<string>): Response<string>;
    catFile(callback?: SimpleGitTaskCallback<string>): Response<string>;
    catFile(options?: string[] | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(options) ? options : callback;
        const opts = Array.isArray(options) ? options : [];

        const promise = (async () => {
            if (opts.length < 1) throw new Error("Invalid options");
            const oid = opts[opts.length - 1];
            const { blob } = await git.readBlob({
                fs: this._fs,
                dir: this._dir,
                oid
            });
            return Buffer.from(blob).toString('utf8');
        })();
        return handleCallback(promise, cb);
    }

    checkIgnore(pathNames: string[], callback?: SimpleGitTaskCallback<string[]>): Response<string[]>;
    checkIgnore(path: string, callback?: SimpleGitTaskCallback<string[]>): Response<string[]>;
    checkIgnore(pathNames: string[] | string, callback?: SimpleGitTaskCallback<string[]>): Response<string[]> {
        const paths = Array.isArray(pathNames) ? pathNames : [pathNames];
        const promise = (async () => {
            const ignored: string[] = [];
            for (const filepath of paths) {
                const isIgnored = await git.isIgnored({
                    fs: this._fs,
                    dir: this._dir,
                    filepath
                });
                if (isIgnored) {
                    ignored.push(filepath);
                }
            }
            return ignored;
        })();
        return handleCallback(promise, callback);
    }

    checkIsRepo(action?: CheckRepoActions, callback?: SimpleGitTaskCallback<boolean>): Response<boolean>;
    checkIsRepo(callback?: SimpleGitTaskCallback<boolean>): Response<boolean>;
    checkIsRepo(action?: CheckRepoActions | SimpleGitTaskCallback<boolean>, callback?: SimpleGitTaskCallback<boolean>): Response<boolean> {
        const cb = isCallback(action) ? action : callback;
        const promise = (async () => {
            try {
                await git.findRoot({ fs: this._fs, filepath: this._dir });
                return true;
            } catch {
                return false;
            }
        })();
        return handleCallback(promise, cb);
    }

    checkout(what: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    checkout(what: string, callback?: SimpleGitTaskCallback<string>): Response<string>;
    checkout(options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    checkout(what?: string | TaskOptions, options?: TaskOptions | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        let ref: string | undefined;
        let cb: SimpleGitTaskCallback<string> | undefined;

        if (typeof what === 'string') {
            ref = what;
            cb = isCallback(options) ? options : callback;
        } else {
            cb = isCallback(what) ? what : isCallback(options) ? options : callback;
        }

        const promise = (async () => {
            if (ref) {
                await git.checkout({
                    fs: this._fs,
                    dir: this._dir,
                    ref
                });
            }
            return '';
        })();
        return handleCallback(promise, cb);
    }

    checkoutBranch(branchName: string, startPoint: string, callback?: SimpleGitTaskCallback<void>): Response<void>;
    checkoutBranch(branchName: string, startPoint: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<void>): Response<void>;
    checkoutBranch(branchName: string, _startPoint: string, optionsOrCallback?: SimpleGitTaskCallback<void> | TaskOptions, callback?: SimpleGitTaskCallback<void>): Response<void> {
        const cb = isCallback(optionsOrCallback) ? optionsOrCallback : callback;
        const promise = (async () => {
            await git.branch({
                fs: this._fs,
                dir: this._dir,
                ref: branchName,
                checkout: true
            });
        })();
        return handleCallback(promise, cb);
    }

    checkoutLatestTag(_branchName: string, _startPoint: string, callback?: SimpleGitTaskCallback<void>): Response<void> {
        return handleCallback(Promise.reject(new Error("checkoutLatestTag is not fully supported")), callback);
    }

    checkoutLocalBranch(branchName: string, callback?: SimpleGitTaskCallback<void>): Response<void>;
    checkoutLocalBranch(branchName: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<void>): Response<void>;
    checkoutLocalBranch(branchName: string, optionsOrCallback?: SimpleGitTaskCallback<void> | TaskOptions, callback?: SimpleGitTaskCallback<void>): Response<void> {
        const cb = isCallback(optionsOrCallback) ? optionsOrCallback : callback;
        const promise = (async () => {
            await git.branch({
                fs: this._fs,
                dir: this._dir,
                ref: branchName,
                checkout: true
            });
        })();
        return handleCallback(promise, cb);
    }

    clean(args: CleanOptions[], options?: TaskOptions, callback?: SimpleGitTaskCallback<CleanSummary>): Response<CleanSummary>;
    clean(mode: CleanMode | string, options?: TaskOptions, callback?: SimpleGitTaskCallback<CleanSummary>): Response<CleanSummary>;
    clean(mode: CleanMode | string, callback?: SimpleGitTaskCallback<CleanSummary>): Response<CleanSummary>;
    clean(options?: TaskOptions): Response<CleanSummary>;
    clean(callback?: SimpleGitTaskCallback<CleanSummary>): Response<CleanSummary>;
    clean(args?: CleanOptions[] | CleanMode | string | TaskOptions | SimpleGitTaskCallback<CleanSummary>, options?: TaskOptions | SimpleGitTaskCallback<CleanSummary>, callback?: SimpleGitTaskCallback<CleanSummary>): Response<CleanSummary> {
        const cb = isCallback(args) ? args : isCallback(options) ? options : callback;
        return handleCallback(Promise.reject(new Error("clean is not supported by isomorphic-git")), cb);
    }

    clearQueue(): this {
        return this;
    }

    clone(repoPath: string, localPath: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    clone(repoPath: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    clone(repoPath: string, localPath?: string | TaskOptions, options?: TaskOptions | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        let dir: string;
        let cb: SimpleGitTaskCallback<string> | undefined;

        if (typeof localPath === 'string') {
            dir = localPath;
            cb = isCallback(options) ? options : callback;
        } else {
            dir = this._dir;
            cb = isCallback(localPath) ? localPath : isCallback(options) ? options : callback;
        }

        const promise = (async () => {
            await git.clone({
                fs: this._fs,
                http: this._http,
                dir,
                url: repoPath,
                singleBranch: true,
                depth: 1
            });
            return dir;
        })();
        return handleCallback(promise, cb);
    }

    commit(message: string | string[], files?: string | string[], options?: Options, callback?: SimpleGitTaskCallback<CommitResult>): Response<CommitResult>;
    commit(message: string | string[], options?: TaskOptions, callback?: SimpleGitTaskCallback<CommitResult>): Response<CommitResult>;
    commit(message: string | string[], files?: string | string[], callback?: SimpleGitTaskCallback<CommitResult>): Response<CommitResult>;
    commit(message: string | string[], callback?: SimpleGitTaskCallback<CommitResult>): Response<CommitResult>;
    commit(message: string | string[], files?: string | string[] | TaskOptions | SimpleGitTaskCallback<CommitResult>, options?: Options | SimpleGitTaskCallback<CommitResult>, callback?: SimpleGitTaskCallback<CommitResult>): Response<CommitResult> {
        const cb = isCallback(files) ? files : isCallback(options) ? options : callback;
        const msg = Array.isArray(message) ? message.join('\n') : message;

        const promise = (async () => {
            const sha = await git.commit({
                fs: this._fs,
                dir: this._dir,
                message: msg,
                author: this._author
            });

            return {
                author: null,
                branch: await git.currentBranch({ fs: this._fs, dir: this._dir }) || '',
                commit: sha,
                root: false,
                summary: {
                    changes: 0,
                    insertions: 0,
                    deletions: 0
                }
            } as CommitResult;
        })();
        return handleCallback(promise, cb);
    }

    countObjects(callback?: SimpleGitTaskCallback<VersionResult>): Response<CountObjectsResult> {
        return handleCallback(Promise.reject(new Error("countObjects is not supported by isomorphic-git")), callback as unknown as SimpleGitTaskCallback<CountObjectsResult>);
    }

    customBinary(_command: Exclude<SimpleGitOptions["binary"], undefined>): this {
        return this;
    }

    cwd(directory: { path: string; root?: boolean }, callback?: SimpleGitTaskCallback<string>): Response<string>;
    cwd<path extends string>(directory: path, callback?: SimpleGitTaskCallback<path>): Response<path>;
    cwd(directory: any, callback?: any): any {
        const path = typeof directory === 'string' ? directory : directory.path;
        this._dir = path;
        const promise = Promise.resolve(path);
        return handleCallback(promise, callback);
    }

    deleteLocalBranch(branchName: string, forceDelete?: boolean, callback?: SimpleGitTaskCallback<BranchSingleDeleteResult>): Response<BranchSingleDeleteResult>;
    deleteLocalBranch(branchName: string, callback?: SimpleGitTaskCallback<BranchSingleDeleteResult>): Response<BranchSingleDeleteResult>;
    deleteLocalBranch(branchName: string, forceDelete?: boolean | SimpleGitTaskCallback<BranchSingleDeleteResult>, callback?: SimpleGitTaskCallback<BranchSingleDeleteResult>): Response<BranchSingleDeleteResult> {
        const cb = isCallback(forceDelete) ? forceDelete : callback;
        const promise = (async () => {
            await git.deleteBranch({
                fs: this._fs,
                dir: this._dir,
                ref: branchName
            });
            return {
                branch: branchName,
                hash: null,
                success: true
            } as unknown as BranchSingleDeleteResult;
        })();
        return handleCallback(promise, cb);
    }

    deleteLocalBranches(branchNames: string[], _forceDelete?: boolean, callback?: SimpleGitTaskCallback<BranchMultiDeleteResult>): Response<BranchMultiDeleteResult> {
        const promise = (async () => {
            const results: BranchSingleDeleteResult[] = [];
            for (const branch of branchNames) {
                try {
                    await git.deleteBranch({
                        fs: this._fs,
                        dir: this._dir,
                        ref: branch
                    });
                    results.push({ branch, hash: null, success: true } as unknown as BranchSingleDeleteResult);
                } catch {
                    results.push({ branch, hash: null, success: false } as unknown as BranchSingleDeleteResult);
                }
            }
            return {
                all: results,
                branches: results.reduce((acc, r) => ({ ...acc, [r.branch]: r }), {}),
                errors: results.filter(r => !r.success),
                success: results.every(r => r.success)
            } as BranchMultiDeleteResult;
        })();
        return handleCallback(promise, callback);
    }

    diff(options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(options) ? options : callback;
        return handleCallback(Promise.reject(new Error("diff is not supported by isomorphic-git")), cb);
    }

    diffSummary(command: string | number, options: TaskOptions, callback?: SimpleGitTaskCallback<DiffResult>): Response<DiffResult>;
    diffSummary(command: string | number, callback?: SimpleGitTaskCallback<DiffResult>): Response<DiffResult>;
    diffSummary(options: TaskOptions, callback?: SimpleGitTaskCallback<DiffResult>): Response<DiffResult>;
    diffSummary(callback?: SimpleGitTaskCallback<DiffResult>): Response<DiffResult>;
    diffSummary(command?: string | number | TaskOptions | SimpleGitTaskCallback<DiffResult>, options?: TaskOptions | SimpleGitTaskCallback<DiffResult>, callback?: SimpleGitTaskCallback<DiffResult>): Response<DiffResult> {
        const cb = isCallback(command) ? command : isCallback(options) ? options : callback;
        return handleCallback(Promise.reject(new Error("diffSummary is not supported by isomorphic-git")), cb);
    }

    env(name: string, value: string): this;
    env(env: object): this;
    env(name: string | object, value?: string): this {
        if (typeof name === 'object') {
            this._env = { ...this._env, ...name };
        } else if (value !== undefined) {
            this._env[name] = value;
        }
        return this;
    }

    exec(handle: () => void): Response<void> {
        handle();
        return Promise.resolve() as Response<void>;
    }

    fetch(remote: string, branch: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<FetchResult>): Response<FetchResult>;
    fetch(remote: string, branch: string, callback?: SimpleGitTaskCallback<FetchResult>): Response<FetchResult>;
    fetch(remote: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<FetchResult>): Response<FetchResult>;
    fetch(options?: TaskOptions, callback?: SimpleGitTaskCallback<FetchResult>): Response<FetchResult>;
    fetch(callback?: SimpleGitTaskCallback<FetchResult>): Response<FetchResult>;
    fetch(remote?: string | TaskOptions | SimpleGitTaskCallback<FetchResult>, branch?: string | TaskOptions | SimpleGitTaskCallback<FetchResult>, options?: TaskOptions | SimpleGitTaskCallback<FetchResult>, callback?: SimpleGitTaskCallback<FetchResult>): Response<FetchResult> {
        let remoteName = 'origin';
        let ref: string | undefined;
        let cb: SimpleGitTaskCallback<FetchResult> | undefined;

        if (typeof remote === 'string') {
            remoteName = remote;
            if (typeof branch === 'string') {
                ref = branch;
                cb = isCallback(options) ? options : callback;
            } else {
                cb = isCallback(branch) ? branch : isCallback(options) ? options : callback;
            }
        } else {
            cb = isCallback(remote) ? remote : isCallback(branch) ? branch as SimpleGitTaskCallback<FetchResult> : callback;
        }

        const promise = (async () => {
            await git.fetch({
                fs: this._fs,
                http: this._http,
                dir: this._dir,
                remote: remoteName,
                ref
            });
            return {
                raw: '',
                remote: remoteName,
                branches: [],
                tags: [],
                updated: [],
                deleted: []
            } as FetchResult;
        })();
        return handleCallback(promise, cb);
    }

    firstCommit(callback?: SimpleGitTaskCallback<string>): Response<string> {
        const promise = (async () => {
            const commits = await git.log({
                fs: this._fs,
                dir: this._dir
            });
            if (commits.length === 0) throw new Error("No commits found");
            return commits[commits.length - 1].oid;
        })();
        return handleCallback(promise, callback);
    }

    getConfig(key: string, scope?: keyof typeof GitConfigScope, callback?: SimpleGitTaskCallback<string>): Response<ConfigGetResult> {
        const cb = isCallback(scope) ? scope : callback;
        const promise = (async () => {
            const value = await git.getConfig({
                fs: this._fs,
                dir: this._dir,
                path: key
            });
            return {
                key,
                value: value || null,
                values: value ? [value] : [],
                scopes: new Map()
            } as ConfigGetResult;
        })();
        return handleCallback(promise, cb as unknown as SimpleGitTaskCallback<ConfigGetResult>);
    }

    getRemotes(callback?: SimpleGitTaskCallback<RemoteWithoutRefs[]>): Response<RemoteWithoutRefs[]>;
    getRemotes(verbose?: false, callback?: SimpleGitTaskCallback<RemoteWithoutRefs[]>): Response<RemoteWithoutRefs[]>;
    getRemotes(verbose: true, callback?: SimpleGitTaskCallback<RemoteWithRefs[]>): Response<RemoteWithRefs[]>;
    getRemotes(verbose?: boolean | SimpleGitTaskCallback<RemoteWithoutRefs[]>, callback?: SimpleGitTaskCallback<RemoteWithoutRefs[]> | SimpleGitTaskCallback<RemoteWithRefs[]>): Response<RemoteWithoutRefs[]> | Response<RemoteWithRefs[]> {
        const cb = isCallback(verbose) ? verbose : callback;
        const promise = (async () => {
            const remotes = await git.listRemotes({
                fs: this._fs,
                dir: this._dir
            });
            return remotes.map(r => ({ name: r.remote })) as RemoteWithoutRefs[];
        })();
        return handleCallback(promise, cb as SimpleGitTaskCallback<RemoteWithoutRefs[]>);
    }

    grep(searchTerm: string | GitGrepQuery, callback?: SimpleGitTaskCallback<GrepResult>): Response<GrepResult>;
    grep(searchTerm: string | GitGrepQuery, options?: TaskOptions, callback?: SimpleGitTaskCallback<GrepResult>): Response<GrepResult>;
    grep(_searchTerm: string | GitGrepQuery, optionsOrCallback?: SimpleGitTaskCallback<GrepResult> | TaskOptions, callback?: SimpleGitTaskCallback<GrepResult>): Response<GrepResult> {
        const cb = isCallback(optionsOrCallback) ? optionsOrCallback : callback;
        return handleCallback(Promise.reject(new Error("grep is not supported by isomorphic-git")), cb);
    }

    hashObject(path: string, callback?: SimpleGitTaskCallback<string>): Response<string>;
    hashObject(path: string, write?: boolean, callback?: SimpleGitTaskCallback<string>): Response<string>;
    hashObject(path: string, writeOrCallback?: SimpleGitTaskCallback<string> | boolean, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(writeOrCallback) ? writeOrCallback : callback;
        const promise = (async () => {
            const fs = this._fs as any;
            const content = fs.promises
                ? await fs.promises.readFile(`${this._dir}/${path}`)
                : await new Promise<Buffer>((resolve, reject) => {
                    fs.readFile(`${this._dir}/${path}`, (err: Error | null, data: Buffer) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });
            const oid = await git.hashBlob({
                object: content as Uint8Array
            });
            return oid.oid;
        })();
        return handleCallback(promise, cb);
    }

    init(bare: boolean, options?: TaskOptions, callback?: SimpleGitTaskCallback<InitResult>): Response<InitResult>;
    init(bare: boolean, callback?: SimpleGitTaskCallback<InitResult>): Response<InitResult>;
    init(options?: TaskOptions, callback?: SimpleGitTaskCallback<InitResult>): Response<InitResult>;
    init(callback?: SimpleGitTaskCallback<InitResult>): Response<InitResult>;
    init(bare?: boolean | TaskOptions | SimpleGitTaskCallback<InitResult>, options?: TaskOptions | SimpleGitTaskCallback<InitResult>, callback?: SimpleGitTaskCallback<InitResult>): Response<InitResult> {
        const isBare = typeof bare === 'boolean' ? bare : false;
        const cb = isCallback(bare) ? bare : isCallback(options) ? options : callback;

        const promise = (async () => {
            await git.init({
                fs: this._fs,
                dir: this._dir,
                bare: isBare
            });
            return {
                bare: isBare,
                existing: false,
                gitDir: this._dir,
                path: this._dir
            } as InitResult;
        })();
        return handleCallback(promise, cb);
    }

    listConfig(scope: keyof typeof GitConfigScope, callback?: SimpleGitTaskCallback<ConfigListSummary>): Response<ConfigListSummary>;
    listConfig(callback?: SimpleGitTaskCallback<ConfigListSummary>): Response<ConfigListSummary>;
    listConfig(scope?: "system" | "global" | "local" | "worktree" | SimpleGitTaskCallback<ConfigListSummary>, callback?: SimpleGitTaskCallback<ConfigListSummary>): Response<ConfigListSummary> {
        const cb = isCallback(scope) ? scope : callback;
        const promise = (async () => {
            const config = await git.getConfigAll({
                fs: this._fs,
                dir: this._dir,
                path: '.'
            });
            return {
                files: [],
                all: config || {},
                values: {}
            } as unknown as ConfigListSummary;
        })();
        return handleCallback(promise, cb);
    }

    listRemote(args?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(args) ? args : callback;
        const promise = (async () => {
            const remotes = await git.listRemotes({
                fs: this._fs,
                dir: this._dir
            });
            return remotes.map(r => `${r.remote}\t${r.url}`).join('\n');
        })();
        return handleCallback(promise, cb);
    }

    log<T = DefaultLogFields>(options?: TaskOptions | LogOptions<T>, callback?: SimpleGitTaskCallback<LogResult<T>>): Response<LogResult<T>> {
        const cb = isCallback(options) ? options : callback;
        const promise = (async () => {
            const commits = await git.log({
                fs: this._fs,
                dir: this._dir
            });

            const all = commits.map(c => ({
                hash: c.oid,
                date: new Date(c.commit.author.timestamp * 1000).toISOString(),
                message: c.commit.message,
                refs: '',
                body: c.commit.message,
                author_name: c.commit.author.name,
                author_email: c.commit.author.email,
                diff: undefined
            })) as T[];

            return {
                all,
                latest: all[0] || null,
                total: all.length
            } as LogResult<T>;
        })();
        return handleCallback(promise, cb);
    }

    merge(options: TaskOptions, callback?: SimpleGitTaskCallback<MergeResult>): Response<MergeResult> {
        const cb = callback;
        const promise = (async () => {
            const optArray = Array.isArray(options) ? options : Object.values(options);
            const theirBranch = optArray.find(o => typeof o === 'string' && !o.startsWith('-')) as string;

            if (!theirBranch) throw new Error("Branch to merge not specified");

            const result = await git.merge({
                fs: this._fs,
                dir: this._dir,
                theirs: theirBranch,
                author: this._author
            });

            return await this.handleMerge(result);
        })();
        return handleCallback(promise, cb);
    }

    mergeFromTo<E extends GitError>(remote: string, branch: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<MergeResult, E>): Response<MergeResult>;
    mergeFromTo<E extends GitError>(remote: string, branch: string, callback?: SimpleGitTaskCallback<MergeResult, E>): Response<MergeResult>;
    mergeFromTo<E extends GitError>(remote: string, branch: string, options?: TaskOptions | SimpleGitTaskCallback<MergeResult, E>, callback?: SimpleGitTaskCallback<MergeResult, E>): Response<MergeResult> {
        const cb = isCallback(options) ? options : callback;
        const promise = (async () => {
            const result = await git.merge({
                fs: this._fs,
                dir: this._dir,
                theirs: `${remote}/${branch}`,
                author: this._author
            });

            return await this.handleMerge(result);
        })();
        return handleCallback(promise, cb as unknown as SimpleGitTaskCallback<MergeResult>);
    }

    private async handleMerge(result: isomorphic.MergeResult) {
        const mergeResult = result.alreadyMerged
            ? 'Already up-to-date.'
            : result.fastForward
                ? 'Fast-forward'
                : 'success';

        const mergedFiles: string[] = [];
        const conflictFiles: string[] = [];

        if (result.tree) {
            const statusMatrix = await git.statusMatrix({
                fs: this._fs,
                dir: this._dir
            });

            for (const [filepath, head, workdir, stage] of statusMatrix) {
                if (stage === 3 || (head !== workdir && workdir !== 0)) {
                    if (stage === 3) {
                        conflictFiles.push(filepath);
                    } else {
                        mergedFiles.push(filepath);
                    }
                }
            }
        }

        return {
            conflicts: conflictFiles,
            merges: mergedFiles,
            result: mergeResult,
            readonly: false,
            hash: result.oid || '',
            summary: {
                changes: mergedFiles.length + conflictFiles.length,
                insertions: 0,
                deletions: 0
            }
        } as unknown as MergeResult;
    }

    mirror(_repoPath: string, _localPath: string, callback?: SimpleGitTaskCallback<string>): Response<string> {
        return handleCallback(Promise.reject(new Error("mirror is not supported by isomorphic-git")), callback);
    }

    mv(_from: string | string[], _to: string, callback?: SimpleGitTaskCallback<MoveSummary>): Response<MoveSummary> {
        return handleCallback(Promise.reject(new Error("mv is not supported by isomorphic-git")), callback);
    }

    outputHandler(_handler: OutputHandler | void): this {
        return this;
    }

    pull(remote?: string, branch?: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<PullResult>): Response<PullResult>;
    pull(options?: TaskOptions, callback?: SimpleGitTaskCallback<PullResult>): Response<PullResult>;
    pull(callback?: SimpleGitTaskCallback<PullResult>): Response<PullResult>;
    pull(remote?: string | TaskOptions | SimpleGitTaskCallback<PullResult>, branch?: string | SimpleGitTaskCallback<PullResult>, _options?: TaskOptions, callback?: SimpleGitTaskCallback<PullResult>): Response<PullResult> {
        let remoteName = 'origin';
        let ref: string | undefined;
        let cb: SimpleGitTaskCallback<PullResult> | undefined;

        if (typeof remote === 'string') {
            remoteName = remote;
            if (typeof branch === 'string') {
                ref = branch;
                cb = callback;
            } else {
                cb = isCallback(branch) ? branch : callback;
            }
        } else {
            cb = isCallback(remote) ? remote : isCallback(branch) ? branch as SimpleGitTaskCallback<PullResult> : callback;
        }

        const promise = (async () => {
            await git.pull({
                fs: this._fs,
                http: this._http,
                dir: this._dir,
                remote: remoteName,
                ref,
                author: this._author
            });
            return {
                files: [],
                insertions: {},
                deletions: {},
                summary: {
                    changes: 0,
                    insertions: 0,
                    deletions: 0
                },
                created: [],
                deleted: [],
                remoteMessages: {
                    all: []
                }
            } as PullResult;
        })();
        return handleCallback(promise, cb);
    }

    push(remote?: string, branch?: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<PushResult>): Response<PushResult>;
    push(options?: TaskOptions, callback?: SimpleGitTaskCallback<PushResult>): Response<PushResult>;
    push(callback?: SimpleGitTaskCallback<PushResult>): Response<PushResult>;
    push(remote?: string | TaskOptions | SimpleGitTaskCallback<PushResult>, branch?: string | SimpleGitTaskCallback<PushResult>, _options?: TaskOptions, callback?: SimpleGitTaskCallback<PushResult>): Response<PushResult> {
        let remoteName = 'origin';
        let ref: string | undefined;
        let cb: SimpleGitTaskCallback<PushResult> | undefined;

        if (typeof remote === 'string') {
            remoteName = remote;
            if (typeof branch === 'string') {
                ref = branch;
                cb = callback;
            } else {
                cb = isCallback(branch) ? branch : callback;
            }
        } else {
            cb = isCallback(remote) ? remote : isCallback(branch) ? branch as SimpleGitTaskCallback<PushResult> : callback;
        }

        const promise = (async () => {
            await git.push({
                fs: this._fs,
                http: this._http,
                dir: this._dir,
                remote: remoteName,
                ref
            });
            return {
                pushed: [],
                branch: { local: ref || '', remote: ref || '', remoteName },
                repo: '',
                ref: { local: ref || '' },
                remoteMessages: { all: [] },
                update: undefined
            } as unknown as PushResult;
        })();
        return handleCallback(promise, cb);
    }

    pushTags(remote: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<PushResult>): Response<PushResult>;
    pushTags(options?: TaskOptions, callback?: SimpleGitTaskCallback<PushResult>): Response<PushResult>;
    pushTags(callback?: SimpleGitTaskCallback<PushResult>): Response<PushResult>;
    pushTags(remote?: string | TaskOptions | SimpleGitTaskCallback<PushResult>, options?: TaskOptions | SimpleGitTaskCallback<PushResult>, callback?: SimpleGitTaskCallback<PushResult>): Response<PushResult> {
        let remoteName = 'origin';
        let cb: SimpleGitTaskCallback<PushResult> | undefined;

        if (typeof remote === 'string') {
            remoteName = remote;
            cb = isCallback(options) ? options : callback;
        } else {
            cb = isCallback(remote) ? remote : isCallback(options) ? options : callback;
        }

        const promise = (async () => {
            const tags = await git.listTags({
                fs: this._fs,
                dir: this._dir
            });

            for (const tag of tags) {
                await git.push({
                    fs: this._fs,
                    http: this._http,
                    dir: this._dir,
                    remote: remoteName,
                    ref: tag
                });
            }

            return {
                pushed: tags.map(t => ({ local: t, remote: t })),
                branch: undefined,
                repo: '',
                remoteMessages: { all: [] }
            } as unknown as PushResult;
        })();
        return handleCallback(promise, cb);
    }

    raw(...args: unknown[]): Response<string> {
        const cb = args.find(isCallback) as SimpleGitTaskCallback<string> | undefined;
        return handleCallback(Promise.reject(new Error("raw commands are not supported by isomorphic-git")), cb);
    }

    rebase(options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    rebase(callback?: SimpleGitTaskCallback<string>): Response<string>;
    rebase(options?: TaskOptions | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(options) ? options : callback;
        return handleCallback(Promise.reject(new Error("rebase is not supported by isomorphic-git")), cb);
    }

    remote(_options: string[], callback?: SimpleGitTaskCallback<void | string>): Response<void | string> {
        const promise = (async () => {
            const remotes = await git.listRemotes({
                fs: this._fs,
                dir: this._dir
            });
            return remotes.map(r => r.remote).join('\n');
        })();
        return handleCallback(promise, callback);
    }

    removeRemote(remoteName: string, callback?: SimpleGitTaskCallback<void>): Response<void> {
        const promise = (async () => {
            await git.deleteRemote({
                fs: this._fs,
                dir: this._dir,
                remote: remoteName
            });
        })();
        return handleCallback(promise, callback);
    }

    reset(...args: unknown[]): Response<string> {
        const cb = args.find(isCallback) as SimpleGitTaskCallback<string> | undefined;
        return handleCallback(Promise.reject(new Error("reset is not fully supported by isomorphic-git")), cb);
    }

    revert(commit: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<void>): Response<void>;
    revert(commit: string, callback?: SimpleGitTaskCallback<void>): Response<void>;
    revert(_commit: string, options?: TaskOptions | SimpleGitTaskCallback<void>, callback?: SimpleGitTaskCallback<void>): Response<void> {
        const cb = isCallback(options) ? options : callback;
        return handleCallback(Promise.reject(new Error("revert is not supported by isomorphic-git")), cb);
    }

    revparse(option: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    revparse(options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    revparse(option?: string | TaskOptions, options?: TaskOptions | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        let ref: string = 'HEAD';
        let cb: SimpleGitTaskCallback<string> | undefined;

        if (typeof option === 'string') {
            ref = option;
            cb = isCallback(options) ? options : callback;
        } else {
            cb = isCallback(option) ? option : isCallback(options) ? options : callback;
        }

        const promise = (async () => {
            return await git.resolveRef({
                fs: this._fs,
                dir: this._dir,
                ref
            });
        })();
        return handleCallback(promise, cb);
    }

    rm(paths: string | string[], callback?: SimpleGitTaskCallback<void>): Response<void> {
        const pathList = Array.isArray(paths) ? paths : [paths];
        const promise = (async () => {
            for (const filepath of pathList) {
                await git.remove({
                    fs: this._fs,
                    dir: this._dir,
                    filepath
                });
            }
        })();
        return handleCallback(promise, callback);
    }

    rmKeepLocal(paths: string | string[], callback?: SimpleGitTaskCallback<void>): Response<void> {
        return this.rm(paths, callback);
    }

    show(option: string | TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    show(callback?: SimpleGitTaskCallback<string>): Response<string>;
    show(option?: string | TaskOptions | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(option) ? option : callback;
        const ref = typeof option === 'string' ? option : 'HEAD';

        const promise = (async () => {
            const oid = await git.resolveRef({
                fs: this._fs,
                dir: this._dir,
                ref
            });
            const commit = await git.readCommit({
                fs: this._fs,
                dir: this._dir,
                oid
            });
            return `commit ${oid}\nAuthor: ${commit.commit.author.name} <${commit.commit.author.email}>\nDate: ${new Date(commit.commit.author.timestamp * 1000).toISOString()}\n\n${commit.commit.message}`;
        })();
        return handleCallback(promise, cb);
    }

    showBuffer(option: string | TaskOptions): Response<Buffer> {
        const ref = typeof option === 'string' ? option : 'HEAD';
        const promise = (async () => {
            const oid = await git.resolveRef({
                fs: this._fs,
                dir: this._dir,
                ref
            });
            const { blob } = await git.readBlob({
                fs: this._fs,
                dir: this._dir,
                oid
            });
            return Buffer.from(blob);
        })();
        return promise as Response<Buffer>;
    }

    silent(_silence?: boolean): this {
        return this;
    }

    stash(options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    stash(callback?: SimpleGitTaskCallback<string>): Response<string>;
    stash(options?: TaskOptions | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(options) ? options : callback;
        return handleCallback(Promise.reject(new Error("stash is not supported by isomorphic-git")), cb);
    }

    stashList(options?: TaskOptions, callback?: SimpleGitTaskCallback<LogResult>): Response<LogResult>;
    stashList(callback?: SimpleGitTaskCallback<LogResult>): Response<LogResult>;
    stashList(options?: TaskOptions | SimpleGitTaskCallback<LogResult>, callback?: SimpleGitTaskCallback<LogResult>): Response<LogResult> {
        const cb = isCallback(options) ? options : callback;
        return handleCallback(Promise.reject(new Error("stashList is not supported by isomorphic-git")), cb);
    }

    status(options?: TaskOptions, callback?: SimpleGitTaskCallback<StatusResult>): Response<StatusResult>;
    status(callback?: SimpleGitTaskCallback<StatusResult>): Response<StatusResult>;
    status(options?: TaskOptions | SimpleGitTaskCallback<StatusResult>, callback?: SimpleGitTaskCallback<StatusResult>): Response<StatusResult> {
        const cb = isCallback(options) ? options : callback;
        const promise = (async () => {
            const statusMatrix = await git.statusMatrix({
                fs: this._fs,
                dir: this._dir
            });

            const not_added: string[] = [];
            const conflicted: string[] = [];
            const created: string[] = [];
            const deleted: string[] = [];
            const ignored: string[] = [];
            const modified: string[] = [];
            const renamed: StatusResultRenamed[] = [];
            const staged: string[] = [];
            const files: StatusResult['files'] = [];

            for (const [filepath, head, workdir, stage] of statusMatrix) {
                if (head === 0 && workdir === 2 && stage === 0) {
                    not_added.push(filepath);
                    files.push({ path: filepath, index: '?', working_dir: '?' });
                } else if (head === 0 && workdir === 2 && stage === 2) {
                    created.push(filepath);
                    staged.push(filepath);
                    files.push({ path: filepath, index: 'A', working_dir: ' ' });
                } else if (head === 1 && workdir === 2 && stage === 2) {
                    modified.push(filepath);
                    staged.push(filepath);
                    files.push({ path: filepath, index: 'M', working_dir: ' ' });
                } else if (head === 1 && workdir === 2 && stage === 1) {
                    modified.push(filepath);
                    files.push({ path: filepath, index: ' ', working_dir: 'M' });
                } else if (head === 1 && workdir === 0 && stage === 0) {
                    deleted.push(filepath);
                    staged.push(filepath);
                    files.push({ path: filepath, index: 'D', working_dir: ' ' });
                } else if (head === 1 && workdir === 0 && stage === 1) {
                    deleted.push(filepath);
                    files.push({ path: filepath, index: ' ', working_dir: 'D' });
                }
            }

            const currentBranch = await git.currentBranch({
                fs: this._fs,
                dir: this._dir
            });

            return {
                not_added,
                conflicted,
                created,
                deleted,
                ignored,
                modified,
                renamed,
                files,
                staged,
                ahead: 0,
                behind: 0,
                current: currentBranch || 'HEAD',
                tracking: null,
                detached: !currentBranch,
                isClean: () => files.length === 0
            } as StatusResult;
        })();
        return handleCallback(promise, cb);
    }

    subModule(options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(options) ? options : callback;
        return handleCallback(Promise.reject(new Error("subModule is not supported by isomorphic-git")), cb);
    }

    submoduleAdd(_repo: string, _path: string, callback?: SimpleGitTaskCallback<string>): Response<string> {
        return handleCallback(Promise.reject(new Error("submoduleAdd is not supported by isomorphic-git")), callback);
    }

    submoduleInit(moduleName: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    submoduleInit(moduleName: string, callback?: SimpleGitTaskCallback<string>): Response<string>;
    submoduleInit(options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    submoduleInit(callback?: SimpleGitTaskCallback<string>): Response<string>;
    submoduleInit(moduleName?: string | TaskOptions | SimpleGitTaskCallback<string>, options?: TaskOptions | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(moduleName) ? moduleName : isCallback(options) ? options : callback;
        return handleCallback(Promise.reject(new Error("submoduleInit is not supported by isomorphic-git")), cb);
    }

    submoduleUpdate(moduleName: string, options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    submoduleUpdate(moduleName: string, callback?: SimpleGitTaskCallback<string>): Response<string>;
    submoduleUpdate(options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string>;
    submoduleUpdate(callback?: SimpleGitTaskCallback<string>): Response<string>;
    submoduleUpdate(moduleName?: string | TaskOptions | SimpleGitTaskCallback<string>, options?: TaskOptions | SimpleGitTaskCallback<string>, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(moduleName) ? moduleName : isCallback(options) ? options : callback;
        return handleCallback(Promise.reject(new Error("submoduleUpdate is not supported by isomorphic-git")), cb);
    }

    tag(options?: TaskOptions, callback?: SimpleGitTaskCallback<string>): Response<string> {
        const cb = isCallback(options) ? options : callback;
        const promise = (async () => {
            const tags = await git.listTags({
                fs: this._fs,
                dir: this._dir
            });
            return tags.join('\n');
        })();
        return handleCallback(promise, cb);
    }

    tags(options?: TaskOptions, callback?: SimpleGitTaskCallback<TagResult>): Response<TagResult>;
    tags(callback?: SimpleGitTaskCallback<TagResult>): Response<TagResult>;
    tags(options?: TaskOptions | SimpleGitTaskCallback<TagResult>, callback?: SimpleGitTaskCallback<TagResult>): Response<TagResult> {
        const cb = isCallback(options) ? options : callback;
        const promise = (async () => {
            const tags = await git.listTags({
                fs: this._fs,
                dir: this._dir
            });
            return {
                all: tags,
                latest: tags[tags.length - 1] || null
            } as TagResult;
        })();
        return handleCallback(promise, cb);
    }

    updateServerInfo(callback?: SimpleGitTaskCallback<string>): Response<string> {
        return handleCallback(Promise.reject(new Error("updateServerInfo is not supported by isomorphic-git")), callback);
    }

    version(callback?: SimpleGitTaskCallback<VersionResult>): Response<VersionResult> {
        const promise = Promise.resolve({
            major: 1,
            minor: 0,
            patch: 0,
            agent: 'isomorphic-git',
            installed: true
        } as VersionResult);
        return handleCallback(promise, callback);
    }

    setAuthor(name: string, email: string): this {
        this._author = { name, email };
        return this;
    }

    getDir(): string {
        return this._dir;
    }

    get fs(): FsClient {
        return this._fs;
    }
}

export function simpleIsomorphicGit(options?: SimpleIsomorphicGitOptions): SimpleIsomorphicGit {
    return new SimpleIsomorphicGit(options);
}

export default simpleIsomorphicGit;

