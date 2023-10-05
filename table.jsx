"use client";

import Split from "@/app/components/split/split3";
import { AgGridReact } from "ag-grid-react";
import { useMemo, useRef, useState, useContext, useEffect, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import InputGroup from "react-bootstrap/InputGroup";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

import { DropDownInput, NumberInput, TextAreaInput, DateInput, TextInput } from "@/app/components/inputs";
import { DataContext } from "@/app/components/context/data-context";
import toast from "react-hot-toast";
import DrugsModal from "./modal";
import Toolbar from "../components/toolbar";

export default function DrugsTable() {
  const supabase = createClientComponentClient();
  const table = useRef();
  const { ctxData, ctxSelected } = useContext(DataContext);
  const [listData, setListData] = ctxData;
  const [selectedPatient, setSelectedPatient] = ctxSelected;
  const [rowData, setRowData] = useState([]);
  const [data, setData] = useState();
  const [selectedNode, setSelectedNode] = useState({});
  const [gridReady, setGridReady] = useState(false);
  const [show, setShow] = useState(false);

  const loadData = async (ptkey) => {
    try {
      if (gridReady == true) {
        table.current.api.showLoadingOverlay();
      }
      const { data, error } = await supabase.from("drugs").select("*").eq("ptkey", ptkey);
      if (data) {
        setRowData(data);
      }
      if (error) {
        toast.error("Error getting data");
        console.error(error);
      }
    } catch (error) {
      toast.error("Error loading data");
      console.error(error);
    }
  };

  const selectAndFlash = (nodes) => {
    table.current.api.ensureNodeVisible(nodes[0]);
    nodes[0].setSelected(true);
    table.current.api.flashCells({ rowNodes: nodes });
  };

  useEffect(() => {
    if (selectedPatient?.key) {
      loadData(selectedPatient.key);
    } else {
      setRowData();
    }
  }, [selectedPatient]);

  const columnDefs = useMemo(
    () => [
      { field: "id", headerName: "id", enableCellChangeFlash: true },
      { field: "ptkey", headerName: "ptkey", hide: true },
      { field: "name", headerName: "name", enableCellChangeFlash: true },
      { field: "dose", headerName: "dose", enableCellChangeFlash: true },
      { field: "time", headerName: "time", enableCellChangeFlash: true },
      { field: "notes", headerName: "notes", enableCellChangeFlash: true },
    ],
    []
  );

  const getSelectedNode = (params) => {
    let nodes = table.current.api.getSelectedNodes();
    if (nodes.length > 0) {
      return nodes[0];
    } else {
      return undefined;
    }
  };

  const insertRow = async (newRow, selectedRow) => {
    try {
      toast.loading("Adding...", { id: "savetoast" });
      let { data, error } = await supabase.from("drugs").insert(newRow).select("*");
      if (error) {
        throw new Error(JSON.stringify(error));
      }
      if (data.length > 0) {
        selectedRow.updateData(data[0]);
        table.current.api.ensureNodeVisible(selectedRow);
        setData(data[0]);
        toast.success("", { id: "savetoast" });
      } else {
        toast(<b>Data was not added! Try again.</b>, { id: "savetoast" });
      }
    } catch (error) {
      toast(<b>{error.message}</b>, { id: "savetoast" });
      console.error(error);
    }
  };
  const saveRow = async (newData, selectedRow, id) => {
    try {
      toast.loading("Saving...", { id: "savetoast" });
      let { data, error } = await supabase.from("drugs").update(newData).eq("id", id).select("*");
      if (error) {
        throw new Error(JSON.stringify(error));
      }
      if (data.length > 0) {
        selectedRow.updateData(data[0]);
        table.current.api.ensureNodeVisible(selectedRow);
        setData(data[0]);
        toast.success("", { id: "savetoast" });
      } else {
        toast(<b>Data was not saved! Try again.</b>, { id: "savetoast" });
      }
    } catch (error) {
      toast(<b>{error.message}</b>, { id: "savetoast" });
      console.error(error);
    }
  };

  const onSaveClick = async () => {
    let selected = getSelectedNode();
    if (!selected) {
      return;
    }
    if (selected.data.id == 0) {
      // new row
      let newR = { ptkey: selectedPatient.key, name: data.name, dose: data.dose, time: data.time, notes: data.notes };
      insertRow(newR, selected);
    }
    if (selected.data.id > 0 && selected.data.id == data.id) {
      // update row
      let newR = { name: data.name, dose: data.dose, time: data.time, notes: data.notes };
      saveRow(newR, selected, data.id);
    }
  };
  const onRefreshClick = useCallback(() => {
    if (selectedPatient?.key) {
      loadData(selectedPatient.key);
    } else {
      setRowData();
    }
  }, [selectedPatient]);
  const onAddClick = (params) => {
    if (!selectedPatient?.key) {
      return;
    }
    let nodd = table.current.api.getRowNode("0");
    if (nodd) {
      if (nodd.data.id == 0) {
        selectAndFlash([nodd]);
        return;
      }
    }
    let { add } = table.current.api.applyTransaction({ add: [{ id: 0, ptkey: "", name: "", dose: null, time: "", notes: "" }] });
    selectAndFlash(add);
  };

  const onRowSelected = (e) => {
    if (e.node.selected) {
      setData(e.data);
      setSelectedNode(e.node);
    }
  };

  const onGridReady = useCallback(() => {
    setGridReady(true);
  }, []);
  const onHide = (params) => {
    setShow(false);
  };

  const onAddMany = (e) => {
    setShow(true);
  };

  const onOK = async (r) => {
    setShow(false);
    let newRows = r.map((x) => {
      let { id, inc, time, ...others } = x;

      return { ...others, time: time + " 00:00:00", ptkey: selectedPatient.key };
    });

    toast.promise(supabase.from("drugs").insert(newRows).select(), {
      loading: <b>Saving...</b>,
      success: ({ data, error }) => {
        if (error) {
          throw new Error(JSON.stringify(error));
        }
        let newNodes = table.current.api.applyTransaction({ add: data });

        setTimeout(() => {
          table.current.api.flashCells({ rowNodes: [newNodes] });
        }, 100);
      },
      error: (err) => {
        return <b>{err.message}</b>;
      },
    });
  };

  return (
    <div className=" d-flex flex-column flex-fill ">
      <Toolbar
        onSaveClick={onSaveClick}
        onAddClick={onAddClick}
        onAddMany={onAddMany}
        onAutoSizeClick={() => table.current.columnApi.autoSizeAllColumns()}
        onSizeToFitClick={() => table.current.api.sizeColumnsToFit()}
        onRefreshClick={onRefreshClick}
      />

      <div className="flex-fill">
        <Split mode="vertical" style={{ width: "100%", border: "1px solid #d5d5d5", borderRadius: 3 }}>
          <div style={{ height: "50%" }}>
            <div className="h-100 ag-theme-alpine tbl-compact ">
              <AgGridReact
                onRowSelected={onRowSelected}
                containerStyle={{ height: "100% " }}
                ref={table}
                defaultColDef={{ editable: false, resizable: true, sortable: true, enableCellChangeFlash: true }}
                columnDefs={columnDefs}
                rowData={rowData}
                rowSelection="single"
                suppressRowDeselection={true}
                getRowId={(params) => params.data.id}
                onFirstDataRendered={() => table.current.api.sizeColumnsToFit()}
                animateRows={true}
                onGridReady={onGridReady}></AgGridReact>
            </div>
          </div>

          <div style={{ height: "50%" }} className=" bg-body">
            <div className=" container-fluid pt-2 overflow-auto h-100">
              <Row className="g-2">
                <Col xs={6} lg={3}>
                  <DateInput value={data?.time ? data.time : ""} onChange={(e) => setData({ ...data, time: e.target.value })} />
                </Col>
                <Col xs={6} lg={3}>
                  <DropDownInput
                    idName="drugName"
                    label="Drug Name"
                    list={["Prednisolon", "L-Asparginase", "Insulin"]}
                    onSelect={(e) => setData({ ...data, name: e })}
                    value={data?.name ? data.name : ""}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                  />
                </Col>
              </Row>
              <Row>
                <Col xs={12} sm={4}>
                  <InputGroup>
                    <NumberInput
                      idName="Dose"
                      label="Dose"
                      value={data?.dose ? data.dose : ""}
                      onChange={(e) => setData({ ...data, dose: e.target.value })}
                    />
                    <InputGroup.Text className="mb-2 ">
                      {data?.name == "Prednisolon" && (
                        <>
                          mg/m<sup>2</sup>
                        </>
                      )}
                      {data?.name == "L-Asparginase" && (
                        <>
                          IU/m<sup>2</sup>
                        </>
                      )}
                    </InputGroup.Text>
                  </InputGroup>
                </Col>
                <Col xs={12} lg={5}>
                  <TextAreaInput
                    idName="Notes"
                    label="Notes"
                    value={data?.notes ? data.notes : ""}
                    onChange={(e) => setData({ ...data, notes: e.target.value })}
                  />
                </Col>
              </Row>
            </div>
          </div>
        </Split>
      </div>
      <DrugsModal show={show} onHide={onHide} onOK={onOK} selectedRow={selectedPatient} />
    </div>
  );
}
