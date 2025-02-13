/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as buffer from 'buffer';
import { fromGitHubURI } from '../common/uri';
import { GitHubRepository } from '../github/githubRepository';
import { ReadonlyFileSystemProvider } from './readonlyFileSystemProvider';

export async function getGitHubFileContent(gitHubRepository: GitHubRepository, fileName: string, branch: string): Promise<Uint8Array> {
	const { octokit, remote } = await gitHubRepository.ensure();
	let fileContent: { data: { content: string; encoding: string; sha: string } } = (await octokit.call(octokit.api.repos.getContent,
		{
			owner: remote.owner,
			repo: remote.repositoryName,
			path: fileName,
			ref: branch,
		},
	)) as any;
	let contents = fileContent.data.content ?? '';

	// Empty contents and 'none' encoding indcates that the file has been truncated and we should get the blob.
	if (contents === '' && fileContent.data.encoding === 'none') {
		const fileSha = fileContent.data.sha;
		fileContent = await octokit.call(octokit.api.git.getBlob, {
			owner: remote.owner,
			repo: remote.repositoryName,
			file_sha: fileSha,
		});
		contents = fileContent.data.content;
	}

	const buff = buffer.Buffer.from(contents, (fileContent.data as any).encoding);
	return buff;
}

/**
 * Provides file contents for documents with githubpr scheme. Contents are fetched from GitHub based on
 * information in the document's query string.
 */
export class GitHubContentProvider extends ReadonlyFileSystemProvider {
	constructor(public gitHubRepository: GitHubRepository) {
		super();
	}

	async readFile(uri: any): Promise<Uint8Array> {
		const params = fromGitHubURI(uri);
		if (!params || params.isEmpty) {
			return new TextEncoder().encode('');
		}

		return getGitHubFileContent(this.gitHubRepository, params.fileName, params.branch);
	}
}