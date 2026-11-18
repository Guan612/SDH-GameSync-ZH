import { ReactNode, useEffect, useState } from "react";
import { IoMdUnlock } from "react-icons/io";
import { IoArrowUpCircle, IoArrowDownCircle } from "react-icons/io5";
import { FaCloudArrowUp, FaCloudArrowDown } from "react-icons/fa6";
import { Navigation, SidebarNavigation, useParams } from "@decky/ui";
import { GLOBAL_SYNC_APP_ID } from "../helpers/commonDefs";
import { getAppName } from "../helpers/utils";
import { get_last_sync_log, sync_local_first, sync_cloud_first, resync_local_first, resync_cloud_first, delete_lock_files } from "../helpers/backend";
import { confirmPopup } from "../components/popups";
import * as Toaster from "../helpers/toaster";
import RoutePage from "../components/routePage";
import LogsView from "../components/logsView";
import FiltersView from "../components/filtersView";
import SharedFiltersView from "../components/sharedFiltersView";
import Logger from "../helpers/logger";
import SyncTaskQueue from "../helpers/syncTaskQueue";
import IconButton from "../components/iconButton";
import SyncFilters from "../helpers/syncFilters";
import Config from "../helpers/config";

interface SyncTargetConfigPageParams {
  appId: string;
}

class SyncTargetConfigPage extends RoutePage<SyncTargetConfigPageParams> {
  readonly route = "sync-target";
  readonly params = ["appId"];

  protected _register(): UnregisterFunction {
    const registrations: Array<Unregisterable> = [];

    registrations.push({ unregister: super._register() });
    registrations.push(SyncTaskQueue.on(SyncTaskQueue.events.FAIL_TOAST_CLICK, (appId) => this.enter({ appId: appId })));

    return () => registrations.forEach(e => e.unregister());
  }

  render(): ReactNode {
    const appId = Number(useParams<SyncTargetConfigPageParams>().appId);
    if (isNaN(appId)) {
      Logger.error(`Invalid appId for sync target config page: ${useParams<SyncTargetConfigPageParams>().appId}`);
      Toaster.toast("无法打开同步设置：游戏 ID 无效");
      Navigation.NavigateBack();
      return;
    }

    const appName = getAppName(appId);

    const [syncInProgress, setSyncInProgress] = useState<boolean>(SyncTaskQueue.busy);
    useEffect(() => {
      const registrations: Array<Unregisterable> = [];

      registrations.push(SyncTaskQueue.on(SyncTaskQueue.events.BUSY, setSyncInProgress));
      registrations.push(SyncFilters.on(SyncFilters.events.SET, (appId: number) => {
        if ((appId > GLOBAL_SYNC_APP_ID) && Config.get("strict_game_sync")) {
          confirmPopup(
            "同步规则已保存",
            <span>
              当前已启用「严格游戏同步」。修改规则后，下次启动游戏并下载存档时可能删除部分本地数据。为避免这种情况，建议现在先将本地文件上传到云端。<br /><br />
              现在上传吗？
            </span>,
            () => SyncTaskQueue.addSyncTask(sync_local_first, appId),
            "立即上传",
            "跳过"
          )
        } else {
          Toaster.toast("同步规则已保存");
        }
      }))

      return () => registrations.forEach(e => e.unregister());
    }, []);

    return <SidebarNavigation
      pages={[
        {
          title: "同步日志",
          // icon: <FaFileAlt />,
          visible: true,
          content:
            <LogsView
              getLog={async () => await get_last_sync_log(appId)}
            >
              {(appId == GLOBAL_SYNC_APP_ID) && (
                <>
                  <IconButton
                    icon={IoMdUnlock}
                    onOKActionDescription="删除锁文件"
                    disabled={syncInProgress}
                    onClick={() => confirmPopup(
                      "删除锁文件",
                      <span>
                        仅在上次同步异常中断并留下锁文件时使用。请先确认没有同步任务正在运行。<br /><br />
                        选择「确认」继续。
                      </span>,
                      () => {
                        delete_lock_files().then(() => {
                          Toaster.toast("锁文件已删除");
                        }).catch((e) => {
                          Logger.error(`Failed to delete lock files: ${e}`);
                          Toaster.toast("删除锁文件失败");
                        });
                      }
                    )}>
                  </IconButton>
                  <IconButton
                    icon={IoArrowUpCircle}
                    onOKActionDescription="重新同步（本地优先）"
                    disabled={syncInProgress}
                    onClick={() => confirmPopup(
                      "重新同步（本地优先）",
                      <span>
                        将重新建立同步基准，冲突时以本地版本为准。建议先备份，这可能需要一段时间。<br /><br />
                        选择「确认」继续。
                      </span>,
                      () => SyncTaskQueue.addSyncTask(_ => resync_local_first(), GLOBAL_SYNC_APP_ID)
                    )}>
                  </IconButton>
                  <IconButton
                    icon={IoArrowDownCircle}
                    onOKActionDescription="重新同步（云端优先）"
                    disabled={syncInProgress}
                    onClick={() => confirmPopup(
                      "重新同步（云端优先）",
                      <span>
                        将重新建立同步基准，冲突时以云端版本为准。建议先备份，这可能需要一段时间。<br /><br />
                        选择「确认」继续。
                      </span>,
                      () => SyncTaskQueue.addSyncTask(_ => resync_cloud_first(), GLOBAL_SYNC_APP_ID)
                    )}>
                  </IconButton>
                </>)}
            </LogsView>
        },
        "separator",
        {
          title: "专用同步规则",
          visible: true,
          content:
            <FiltersView
              description={<>仅用于「<i>{appName}</i>」的规则，与共享规则一起生效，优先级低于共享规则。</>}
              getFiltersFunction={() => SyncFilters.get(appId)}
              setFiltersFunction={(filters) => SyncFilters.set(appId, filters)}
            >
              <IconButton
                icon={FaCloudArrowUp}
                onOKActionDescription={(appId == GLOBAL_SYNC_APP_ID) ? "立即同步（本地优先）" : "立即上传到云端"}
                disabled={syncInProgress}
                onClick={() => SyncTaskQueue.addSyncTask(sync_local_first, appId)}>
              </IconButton>
              <IconButton
                icon={FaCloudArrowDown}
                onOKActionDescription={(appId == GLOBAL_SYNC_APP_ID) ? "立即同步（云端优先）" : "立即下载到本地"}
                disabled={syncInProgress}
                onClick={() => SyncTaskQueue.addSyncTask(sync_cloud_first, appId)}>
              </IconButton>
            </FiltersView>
        },
        {
          title: "共享同步规则",
          visible: true,
          content:
            <SharedFiltersView
              description="适用于所有同步任务的规则，与专用规则一起生效，优先级高于专用规则。"
            />
        },
      ]}
    />
  }
}

const syncTargetConfigPage = new SyncTargetConfigPage();
export default syncTargetConfigPage;
