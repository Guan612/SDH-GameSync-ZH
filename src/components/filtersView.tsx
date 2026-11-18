import { PropsWithChildren, ReactNode, useEffect, useRef, useState } from "react";
import { FaCopy, FaPen } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { DialogButton, ReorderableEntry, ReorderableList } from "@decky/ui";
import { CSS_STEAM_HIGHLIGHT_COLOR } from "../helpers/commonDefs";
import { textInputPopup } from "./popups";
import * as Toaster from "../helpers/toaster";
import * as Clipboard from "../helpers/clipboard";
import PageView from "./pageView";
import FilterPickerButton from "./filePickerButton";
import Config from "../helpers/config";
import Row from "./row";
import IconButton from "./iconButton";

interface FiltersViewProps {
  description?: ReactNode;
  getFiltersFunction: () => Promise<Array<string>>;
  setFiltersFunction: (filters: Array<string>) => Promise<void>;
}

export default function filtersView({ description, getFiltersFunction, setFiltersFunction: setFiltersFunction, children }: PropsWithChildren<FiltersViewProps>) {
  const saveButtonRef = useRef<HTMLDivElement>(null);

  const [filterEntries, setFilterEntries] = useState<Array<ReorderableEntry<void>>>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(Config.get("advanced_mode"));

  useEffect(() => {
    getFiltersFunction().then(filterEntriesFromArray);
    const registrations: Array<Unregisterable> = [];
    registrations.push(Config.on("advanced_mode", setShowAdvancedOptions));
    return () => {
      registrations.forEach(e => e.unregister());
    }
  }, []);

  const filterEntriesToArray = (): Array<string> => {
    return filterEntries
      .sort((a, b) => a.position - b.position)
      .map((e) => String(e.label));
  }

  const filterEntriesfromString = (text: string): void => {
    filterEntriesFromArray(text.split('\n'));
  }

  const filterEntriesFromArray = (arr: Array<string>): void => {
    setFilterEntries(arr.map((value, index) => ({
      label: value,
      position: index,
    })));
  }

  const filterEntriesAppend = (text: string): void => {
    setFilterEntries(filterEntries.concat(
      text.split('\n').map((value, index) => ({
        label: value,
        position: index + filterEntries.length,
      })
      )));
  }

  const filterEntriesRemove = (position: number): void => {
    setFilterEntries(filterEntries
      .filter((entry) => entry.position != position)
      .map((entry) => ({
        ...entry,
        position: entry.position > position ? entry.position - 1 : entry.position
      }))
    );
  }

  const filterEntriesEdit = (position: number, value: string): void => {
    setFilterEntries(filterEntries.map((entry) => {
      if (entry.position == position) {
        return {
          ...entry,
          label: value,
        };
      }
      return entry;
    }));
  }

  return (
    <PageView
      description={description}
      actionItems={children}
    >
      <ReorderableList
        onSave={setFilterEntries}
        entries={filterEntries}
        interactables={(props: { entry: ReorderableEntry<void> }) =>
          <div style={{
            height: "28px",
          }}>
            <Row>
              {showAdvancedOptions && (<>
                <IconButton
                  icon={FaCopy}
                  onOKActionDescription="复制"
                  onClick={() => {
                    Clipboard.copy(String(props.entry.label));
                    Toaster.toast("已复制到剪贴板");
                  }}
                />
                <IconButton
                  icon={FaPen}
                  onOKActionDescription="编辑"
                  onClick={() => textInputPopup("编辑同步规则", {
                    value: String(props.entry.label),
                    set: (value) => filterEntriesEdit(props.entry.position, value),
                  }
                  )}
                />
              </>)}
              <IconButton
                icon={MdDelete}
                onOKActionDescription="移除规则"
                onClick={() => filterEntriesRemove(props.entry.position)}
              />
            </Row>
          </div>
        }
      />
      <div style={{
        display: "flex",
        flexDirection: "column",
        paddingTop: "8px",
        paddingBottom: "20px",
        gap: "4px",
      }}>
        <Row>
          <FilterPickerButton
            text="添加包含规则"
            onConfirm={(path: string) => filterEntriesAppend(`+ ${path}`)}
          />
          <FilterPickerButton
            text="添加排除规则"
            onConfirm={(path: string) => filterEntriesAppend(`- ${path}`)}
          />
        </Row>
        {showAdvancedOptions && (
          <>
            <Row>
              <DialogButton
                onClick={() => {
                  Clipboard.copy(filterEntriesToArray().join('\n'));
                  Toaster.toast("同步规则已复制到剪贴板")
                }}
              >
                复制所有规则
              </DialogButton>
              <DialogButton
                onClick={() => {
                  const text = Clipboard.paste().trim();
                  if (text) {
                    filterEntriesAppend(text);
                    Toaster.toast("已从剪贴板追加规则");
                  } else {
                    Toaster.toast("剪贴板为空");
                  }
                }}
              >
                粘贴规则（追加）
              </DialogButton>
              <DialogButton
                onClick={() => {
                  const text = Clipboard.paste().trim();
                  if (text) {
                    filterEntriesfromString(text);
                    Toaster.toast("已用剪贴板内容替换规则");
                  } else {
                    Toaster.toast("剪贴板为空");
                  }
                }}
              >
                粘贴规则（替换）
              </DialogButton>
            </Row>
            <Row>
              <DialogButton
                onClick={() => textInputPopup(
                  "添加自定义规则", {
                    value: "",
                    set: (value: string) => filterEntriesAppend(`${value}`),
                  }
                )}
              >
                添加自定义规则
              </DialogButton>
              <DialogButton
                onClick={() => setFilterEntries([])}
              >
                清空规则
              </DialogButton>
            </Row>
          </>
        )}
        <Row>
          <DialogButton
            onClick={() => setFiltersFunction(filterEntriesToArray())}
            ref={saveButtonRef}
            style={{ backgroundColor: CSS_STEAM_HIGHLIGHT_COLOR }}
            onGamepadFocus={() => saveButtonRef.current && (saveButtonRef.current.style.backgroundColor = "white")}
            onGamepadBlur={() => saveButtonRef.current && (saveButtonRef.current.style.backgroundColor = CSS_STEAM_HIGHLIGHT_COLOR)}
          >
            保存规则
          </DialogButton>
        </Row>
      </div>
    </PageView>
  )
}