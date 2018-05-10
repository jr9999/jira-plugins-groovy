//@flow
import * as React from 'react';

import {connect} from 'react-redux';

import memoizeOne from 'memoize-one';

import Avatar from '@atlaskit/avatar';
import Lozenge from '@atlaskit/lozenge';
import InlineDialog from '@atlaskit/inline-dialog';
import {ToggleStateless} from '@atlaskit/toggle';
import {colors} from '@atlaskit/theme';

import type {Appearances} from '@atlaskit/lozenge/dist/cjs/Lozenge/index';

import ErrorIcon from '@atlaskit/icon/glyph/error';
import InfoIcon from '@atlaskit/icon/glyph/info';

import {RunNowDialog} from './RunNowDialog';
import {types} from './types';

import type {RunOutcomeType, ScheduledTaskType} from './types';

import {ScriptParameters} from '../common/script';

import {scheduledTaskService} from '../service/services';

import {ScheduledTaskMessages} from '../i18n/scheduled.i18n';
import {FieldMessages} from '../i18n/common.i18n';
import {ItemActionCreators, WatchActionCreators} from '../common/redux';

import type {VoidCallback} from '../common/types';
import type {ScriptParam} from '../common/script/ScriptParameters';
import {WatchableScript} from '../common/script/WatchableScript';
import type {ScriptComponentProps} from '../common/script-list/types';


function getOutcomeLozengeAppearance(outcome: RunOutcomeType): Appearances {
    switch(outcome) {
        case 'SUCCESS':
            return 'success';
        case 'ABORTED':
            return 'moved';
        case 'UNAVAILABLE':
        case 'FAILED':
            return 'removed';
        case 'NOT_RAN':
            return 'default';
        default:
            return 'default';
    }
}

const ConnectedWatchableScript = connect(
    memoizeOne(
        (state: *): * => {
            return {
                watches: state.watches
            };
        }
    ),
    WatchActionCreators
)(WatchableScript);

type Props = ScriptComponentProps<ScheduledTaskType> & {
    updateItem: typeof ItemActionCreators.updateItem,
    deleteItem: typeof ItemActionCreators.deleteItem,
};

type State = {
    showStatusInfo: boolean,
    showRunDialog: boolean
};

export class ScheduledTaskInternal extends React.Component<Props, State> {
    state = {
        showStatusInfo: false,
        showRunDialog: false
    };

    _edit = () => this.props.onEdit(this.props.script.id);

    _delete = () => {
        const {script} = this.props;

        // eslint-disable-next-line no-restricted-globals
        if (confirm(`Are you sure you want to delete "${script.name}"?`)) {
            scheduledTaskService
                .doDelete(script.id)
                .then(() => this.props.deleteItem(script.id));
        }
    };

    _showStatusInfo = () => this.setState({ showStatusInfo: true });

    _hideStatusInfo = () => this.setState({ showStatusInfo: false });

    _toggleEnabled = () => {
        const {script, updateItem} = this.props;

        const enabled = !script.enabled;

        scheduledTaskService
            .setEnabled(script.id, enabled)
            .then(() => updateItem({...script, enabled}));
    };

    _toggleRunNow = () => this.setState((state: State): * => {
        return {
            showRunDialog: !state.showRunDialog
        };
    });

    _getParams = memoizeOne(
        (task: ScheduledTaskType): Array<ScriptParam> => {
            const params = [
                {
                    label: FieldMessages.schedule,
                    value: task.scheduleExpression
                }
            ];

            if (task.user) {
                params.push({
                    label: ScheduledTaskMessages.runAs,
                    value: (
                        <div className="flex-row">
                            <Avatar size="xsmall" appearance="square" src={task.user.imgSrc}/>
                            <div className="flex-vertical-middle">
                                {' '}{task.user.label}
                            </div>
                        </div>
                    )
                });
            }

            if (task.issueJql) {
                params.push({
                    label: FieldMessages.issueJql,
                    value: task.issueJql
                });
            }

            if (task.issueWorkflow && task.issueWorkflowAction) {
                params.push({
                    label: FieldMessages.workflowAction,
                    value: `${task.issueWorkflow.label}' - '${task.issueWorkflowAction.label}`
                });
            }

            if ((task.type === 'ISSUE_JQL_TRANSITION') && task.transitionOptions) {
                params.push({
                    label: ScheduledTaskMessages.transitionOptions,
                    value: Object
                        .keys(task.transitionOptions)
                        .filter(key => task.transitionOptions[key])
                        //$FlowFixMe
                        .map(key => ScheduledTaskMessages.transitionOption[key])
                        .join(', ') || 'None'
                });
            }

            return params;
        }
    );

    render(): React.Node {
        const {script} = this.props;
        const {showStatusInfo, showRunDialog} = this.state;
        const {lastRunInfo} = script;

        const outcome = lastRunInfo ? lastRunInfo.outcome : 'NOT_RAN';

        const isError = outcome === 'FAILED';
        const lastRun = lastRunInfo ?
            <div className="flex-column">
                <strong>{ScheduledTaskMessages.lastRun}{':'}</strong>
                <div>
                    {lastRunInfo.startDate}{' - '}{lastRunInfo.duration/1000}{'s'}
                </div>
                {lastRunInfo.message && <div className="flex-row">
                    <div style={{color: isError ? colors.R400 : colors.P300}}>
                        {isError ? <ErrorIcon size={'medium'}/> : <InfoIcon size={'medium'}/>}
                    </div>
                    <div className="TaskRunMessage">
                        {lastRunInfo.message}
                    </div>
                </div>}
            </div> : '';

        const popup = <div className="flex-column">
            <div>
                <strong>{ScheduledTaskMessages.nextRun}{':'}</strong>
                <div>{script.nextRunDate || 'unavailable'}</div>
            </div>
            {lastRun}
        </div>;
        let titleEl: React.Node = (
            <div className="flex-row space-between">
                <div className="flex-vertical-middle">
                    <ToggleStateless
                        isChecked={script.enabled}
                        onChange={this._toggleEnabled}
                    />
                </div>
                <div className="flex-vertical-middle">
                    <span style={{marginTop: '2px', marginLeft: '2px'}}>
                        {types[script.type].name}{': '}
                        <strong>{script.name}</strong>
                    </span>
                </div>
                <div className="flex-vertical-middle">
                    <InlineDialog
                        content={popup}
                        isOpen={showStatusInfo}
                        respondsTo="hover"
                        alignment="bottom center"
                    >
                        <div
                            className="flex-vertical-middle"
                            onMouseEnter={this._showStatusInfo}
                            onMouseLeave={this._hideStatusInfo}
                        >
                            <Lozenge appearance={getOutcomeLozengeAppearance(outcome)} isBold={true}>
                                {outcome}
                            </Lozenge>
                        </div>
                    </InlineDialog>
                </div>
            </div>
        );

        const scriptObject = (script.type !== 'ISSUE_JQL_TRANSITION') ? {
            id: script.uuid,
            name: script.name,
            scriptBody: script.scriptBody,
            inline: true,
            changelogs: script.changelogs,
            description: script.description
        } : null;

        return (
            <ConnectedWatchableScript
                entityId={script.id}
                entityType="SCHEDULED_TASK"

                withChangelog={true}
                script={scriptObject}
                title={titleEl}
                onEdit={this._edit}
                onDelete={this._delete}

                dropdownItems={[
                    {
                        label: ScheduledTaskMessages.runNow,
                        onClick: this._toggleRunNow
                    }
                ]}
            >
                {script.type === 'ISSUE_JQL_TRANSITION' && script.description &&
                    <div className="scriptDescription">
                        {script.description}
                    </div>
                }
                <ScriptParameters
                    params={this._getParams(script)}
                />
                {showRunDialog && <RunNowDialog task={script} onClose={this._toggleRunNow}/>}
            </ConnectedWatchableScript>
        );
    }
}

export const ScheduledTask = connect(
    null,
    {
        updateItem: ItemActionCreators.updateItem,
        deleteItem: ItemActionCreators.deleteItem
    }
)(ScheduledTaskInternal);