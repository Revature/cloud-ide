"use client";

import React, { useState } from "react";
import ScriptView from "@/components/script/ScriptView";
import ScriptEditForm from "@/components/script/ScriptEditForm";
import { useDeleteScript, useScriptsByImageId } from "@/hooks/type-query/useScripts";
import { Script } from "@/types/scripts";
import { BaseTable } from "../tables/BaseTable";

interface ScriptDetailsProps {
  imageId: number;
  setPhase: (isAdding: boolean) => void;
}

const ScriptDetails: React.FC<ScriptDetailsProps> = ({ imageId, setPhase }) => {
  const { data: scripts = [], isLoading, error } = useScriptsByImageId(imageId);
  const { mutate: deleteScript } = useDeleteScript(imageId);

  const [currentView, setCurrentView] = useState<"details" | "view" | "edit">("details");
  const [selectedScriptId, setSelectedScriptId] = useState<number>(0);

  const handleViewScript = (scriptId: number) => {
    setSelectedScriptId(scriptId);
    setCurrentView("view");
  };

  const handleEditScript = (scriptId: number) => {
    setSelectedScriptId(scriptId);
    setCurrentView("edit");
  };

  const handleBackToDetails = () => {
    setCurrentView("details");
    setSelectedScriptId(0);
  };

  if (isLoading) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400">
        Loading scripts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 dark:text-red-400">
        Error loading scripts
      </div>
    );
  }

  if (currentView === "view" && selectedScriptId) {
    return (
      <ScriptView
        scriptId={selectedScriptId}
        onBack={handleBackToDetails} // Pass a callback to return to the details view
      />
    );
  }

  if (currentView === "edit" && selectedScriptId) {
    return (
      <ScriptEditForm
        imageId={imageId}
        scriptId={selectedScriptId}
        onCancel={handleBackToDetails} // Pass a callback to return to the details view
      />
    );
  }

  const columns = [
    {
      header: "Name",
      accessor: (script: Script) => (
        <a
          onClick={() => handleViewScript(script.id)}
          className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 cursor-pointer"
        >
          {script.name}
        </a>
      ),
      searchAccessor: (script: Script) => script.name || "",
    },
    {
      header: "Event",
      accessor: (script: Script) => script.event,
      searchAccessor: (script: Script) => script.event || "",
    },
    {
      header: "Description",
      accessor: (script: Script) => script.description,
      searchAccessor: (script: Script) => script.description || "",
    },
  ];

  const actions = (script: Script) => ({
    "View Details": () => handleViewScript(script.id),
    "Edit Script": () => handleEditScript(script.id),
  });

  return (
    <BaseTable
      data={scripts}
      queryKey={["scripts", "image", imageId]}
      columns={columns}
      title="Scripts"
      searchPlaceholder="Search scripts..."
      actions={actions}
      onDelete={(script) => deleteScript(script!.id)}
      onAddClick={() => setPhase(true)} // Switch to add script form
      addButtonText="Add Script"
      itemsPerPage={5}
    />
  );
};

export default ScriptDetails;