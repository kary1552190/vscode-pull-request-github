/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { render } from 'react-dom';
import { CreateMethod, CreateParamsNew, RemoteInfo } from '../../common/views';
import { compareIgnoreCase } from '../../src/common/utils';
import { isTeam, MergeMethod } from '../../src/github/interface';
import PullRequestContextNew from '../common/createContextNew';
import { ErrorBoundary } from '../common/errorBoundary';
import { LabelCreate } from '../common/label';
import { assigneeIcon, chevronDownIcon, labelIcon, mergeMethodIcon, milestoneIcon, prBaseIcon, prMergeIcon, reviewerIcon } from '../components/icon';
import { MergeSelect } from '../components/merge';

type CreateMethodLabel = {
	[method in CreateMethod]: string;
}
const CreateMethodLabels: CreateMethodLabel = {
	'create-draft': 'Create Draft',
	'create': 'Create',
	'create-automerge': 'Create & Auto-Merge',
};

export const ChooseRemoteAndBranch = ({ onClick, defaultRemote, defaultBranch, isBase, remoteCount = 0, disabled }:
	{ onClick: (remote?: RemoteInfo, branch?: string) => Promise<void>, defaultRemote: RemoteInfo | undefined, defaultBranch: string | undefined, isBase: boolean, remoteCount: number | undefined, disabled: boolean }) => {

	const defaultsLabel = (defaultRemote && defaultBranch) ? `${remoteCount > 1 ? `${defaultRemote.owner}/` : ''}${defaultBranch}` : '-';
	const title = isBase ? 'Base branch: ' + defaultsLabel : 'Branch to merge: ' + defaultsLabel;

	return <ErrorBoundary>
		<div className='flex'>
			<button title={title} aria-label={title} disabled={disabled} onClick={() => {
				onClick(defaultRemote, defaultBranch);
			}}>
				{defaultsLabel}
			</button>
		</div>
	</ErrorBoundary>;
};


export function main() {
	render(
		<Root>
			{(params: CreateParamsNew) => {
				const ctx = useContext(PullRequestContextNew);
				const [isBusy, setBusy] = useState(false);

				const titleInput = useRef<HTMLInputElement>() as React.MutableRefObject<HTMLInputElement>;

				function updateTitle(title: string): void {
					if (params.validate) {
						ctx.updateState({ pendingTitle: title, showTitleValidationError: !title });
					} else {
						ctx.updateState({ pendingTitle: title });
					}
				}

				async function create(): Promise<void> {
					setBusy(true);
					const hasValidTitle = ctx.validate();
					if (!hasValidTitle) {
						titleInput.current?.focus();
					} else {
						await ctx.submit();
					}
					setBusy(false);
				}

				let isCreateable: boolean = true;
				if (ctx.createParams.baseRemote && ctx.createParams.compareRemote && ctx.createParams.baseBranch && ctx.createParams.compareBranch
					&& compareIgnoreCase(ctx.createParams.baseRemote?.owner, ctx.createParams.compareRemote?.owner) === 0
					&& compareIgnoreCase(ctx.createParams.baseRemote?.repositoryName, ctx.createParams.compareRemote?.repositoryName) === 0
					&& compareIgnoreCase(ctx.createParams.baseBranch, ctx.createParams.compareBranch) === 0) {

					isCreateable = false;
				}

				const onKeyDown = useCallback(
					e => {
						if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
							e.preventDefault();
							create();
						}
					},
					[create],
				);
				const mergeMethodSelect: React.MutableRefObject<HTMLSelectElement> = React.useRef<HTMLSelectElement>() as React.MutableRefObject<HTMLSelectElement>;
				const createMethodSelect: React.MutableRefObject<HTMLSelectElement> = React.useRef<HTMLSelectElement>() as React.MutableRefObject<HTMLSelectElement>;

				const onCreateButton = () => {
					const selected = createMethodSelect.current?.value as CreateMethod;
					let isDraft = false;
					let autoMerge = false;
					switch (selected) {
						case 'create-draft':
							isDraft = true;
							autoMerge = false;
							break;
						case 'create-automerge':
							isDraft = false;
							autoMerge = true;
							break;
					}
					ctx.updateState({ isDraft, autoMerge, defaultCreateMethod: selected });
					return create();
				};

				return <div className='group-main'>
					<div className='group-branches'>
						<div className='input-label base'>
							<div className="deco">
								<span title='Base branch'>{prBaseIcon} Base</span>
							</div>
							<ChooseRemoteAndBranch onClick={ctx.changeBaseRemoteAndBranch}
								defaultRemote={params.baseRemote}
								defaultBranch={params.baseBranch}
								remoteCount={params.remoteCount}
								isBase={true}
								disabled={!ctx.initialized} />
						</div>

						<div className='input-label merge'>
							<div className="deco">
								<span title='Merge branch'>{prMergeIcon} Merge</span>
							</div>
							<ChooseRemoteAndBranch onClick={ctx.changeMergeRemoteAndBranch}
								defaultRemote={params.compareRemote}
								defaultBranch={params.compareBranch}
								remoteCount={params.remoteCount}
								isBase={false}
								disabled={!ctx.initialized} />
						</div>
					</div>

					<div className='group-title'>
						<input
							id='title'
							type='text'
							ref={titleInput}
							name='title'
							value={params.pendingTitle ?? ''}
							className={params.showTitleValidationError ? 'input-error' : ''}
							aria-invalid={!!params.showTitleValidationError}
							aria-describedby={params.showTitleValidationError ? 'title-error' : ''}
							placeholder='Title'
							aria-label='Title'
							title='Required'
							required
							onChange={(e) => updateTitle(e.currentTarget.value)}
							onKeyDown={onKeyDown}
							disabled={!ctx.initialized}>
						</input>
						<div id='title-error' className={params.showTitleValidationError ? 'validation-error below-input-error' : 'hidden'}>A title is required</div>
					</div>

					<div className='group-additions'>

						{params.assignees && (params.assignees.length > 0) ?
							<div className='assignees'>
								<span title='Assignees'>{assigneeIcon}</span>
								<ul aria-label="Assignees" tabIndex={0}>
									{params.assignees.map(assignee =>
										<li>
											{assignee.login}
										</li>)}
								</ul>
							</div>
							: null}

						{params.reviewers && (params.reviewers.length > 0) ?
							<div className='reviewers'>
								<span title='Reviewers'>{reviewerIcon}</span>
								<ul aria-label="Reviewers" tabIndex={0}>
									{params.reviewers.map(reviewer =>
										<li>
											{isTeam(reviewer) ? reviewer.slug : reviewer.login}
										</li>)}
								</ul>
							</div>
							: null}

						{params.labels && (params.labels.length > 0) ?
							<div className='labels'>
								<span title='Labels'>{labelIcon}</span>
								<ul aria-label="Labels" onClick={() => {
									ctx.postMessage({ command: 'pr.changeLabels', args: null });
								}}>
									{params.labels.map(label => <LabelCreate key={label.name} {...label} canDelete isDarkTheme={!!params.isDarkTheme} />)}
								</ul>
							</div>
						: null}

						{params.milestone ?
							<div className='milestone'>
								<span title='Milestone'>{milestoneIcon}</span>
								<ul aria-label="Milestone" tabIndex={0}>
									<li>
										{params.milestone.title}
									</li>
								</ul>
							</div>
							: null}
					</div>

					<div className='group-description'>
						<textarea
							id='description'
							name='description'
							placeholder='Description'
							aria-label='Description'
							value={params.pendingDescription}
							onChange={(e) => ctx.updateState({ pendingDescription: e.currentTarget.value })}
							onKeyDown={onKeyDown}
							disabled={!ctx.initialized}></textarea>
					</div>

					<div className={params.validate && !!params.createError ? 'wrapper validation-error' : 'hidden'} aria-live='assertive'>
						<ErrorBoundary>
							{params.createError}
						</ErrorBoundary>
					</div>

					<div className='group-actions'>

						{params.allowAutoMerge ? (
							<div className='merge-method'>
								{mergeMethodIcon}
								<MergeSelect
									name='merge-method'
									title='Merge Method'
									aria-label='Merge Method'
									ref={mergeMethodSelect}
									defaultMergeMethod={params.defaultMergeMethod!}
									mergeMethodsAvailability={params.mergeMethodsAvailability!}
									onChange={() => {
										ctx.updateState({ autoMergeMethod: mergeMethodSelect.current?.value as MergeMethod });
									}}
									disabled={!ctx.initialized}
								/>
							</div>
						)
							: null}

						<div className='spacer'></div>
						<button disabled={isBusy} className='secondary' onClick={() => ctx.cancelCreate()}>
							Cancel
						</button>
						<div className='create-button'>
							<button className='split-left' disabled={isBusy || !isCreateable || !ctx.initialized} onClick={onCreateButton}>
								{CreateMethodLabels[ctx.createParams.defaultCreateMethod]}
							</button>
							<div className='split-right'>
								{chevronDownIcon}
								<select ref={createMethodSelect} name='create-action' disabled={isBusy || !isCreateable || !ctx.initialized}
									title='Create Actions' aria-label='Create Actions'
									defaultValue={ctx.createParams.defaultCreateMethod}
									onChange={onCreateButton}>
									<option value={'create'}>{CreateMethodLabels['create']}</option>
									<option value={'create-draft'}>{CreateMethodLabels['create-draft']}</option>
									{params.allowAutoMerge ? <option value={'create-automerge'}>{CreateMethodLabels['create-automerge']} ({params.autoMergeMethod})</option> : null}
								</select>
							</div>
						</div>
					</div>
				</div>;
			}}
		</Root>,
		document.getElementById('app'),
	);
}

export function Root({ children }) {
	const ctx = useContext(PullRequestContextNew);
	const [pr, setPR] = useState<any>(ctx.createParams);
	useEffect(() => {
		ctx.onchange = setPR;
		setPR(ctx.createParams);
	}, []);
	ctx.postMessage({ command: 'ready' });
	return children(pr);
}
