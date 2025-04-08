"use client";
import { VMImage } from "@/types";
import React, { createContext, useContext, useState, ReactNode } from "react";


// Define runner states
export type RunnerState = "starting" | "ready" | "awaiting_client" | "active" | "terminated";

// Define the runner interface
export interface Runner {
  id: string;
  user?: string; // Optional because runners in the pool don't have a user yet
  image: VMImage;
  keyPairName: string;
  state: RunnerState;
  url?: string; // Will be populated when the runner is ready
  sessionStart?: string; // When user requests runner
  sessionEnd?: string; // When runner expires
  createdAt: string;
}

// Define a separate interface for new runners
export interface NewRunner {
  image: VMImage;
  durationMinutes: number;
}

// Generate a random string to simulate backend-generated identifiers
const generateRandomId = () => {
  return 'run_' + Math.random().toString(36).substring(2, 12);
};

// Function to generate a key pair name based on current date
const generateKeyPairName = () => {
  const today = new Date();
  return `KeyPair-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// Function to format date for display
const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Calculate session end based on start time and duration
const calculateSessionEnd = (startTime: Date, durationMinutes: number) => {
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);
  return endTime;
};

// Initial sample data
const initialRunners: Runner[] = [
  {
    id: 'run_a1b2c3d4e5',
    image: {
      name: "Ubuntu Developer",
      description: "Standard Ubuntu development environment with common development tools",
      identifier: "img_a7b3c9d2e5",
      machine: {
        name: "Medium",
        identifier: "t2.medium",
        cpuCount: 2,
        memorySize: 4,
        storageSize: 50,
        id: 1
      },
      active: true,
      createdOn: "Jan 15, 2025",
      updatedOn: "Feb 20, 2025",
      id: 1,
      runnerPoolSize: 1
    },
    keyPairName: "KeyPair-2025-03-13",
    state: "active",
    user: "john.doe@revature.com",
    url: "https://ide.revature.com/run_a1b2c3d4e5",
    sessionStart: "Mar 13, 2025, 08:30 AM",
    sessionEnd: "Mar 13, 2025, 11:30 AM",
    createdAt: "Mar 13, 2025, 08:15 AM"
  },
  {
    id: 'run_f6g7h8i9j0',
    image: {
      name: "Data Science Workbench",
      description: "Data science environment with Python, R, and Jupyter",
      identifier: "img_f8g6h4j2k1",
      machine: {
        name: "XLarge",
        identifier: "t2.xlarge",
        cpuCount: 4,
        memorySize: 16,
        storageSize: 200,
        id: 2
      },
      active: true,
      createdOn: "Jan 20, 2025",
      updatedOn: "Feb 25, 2025",
      id: 2,
      runnerPoolSize: 1
    },
    keyPairName: "KeyPair-2025-03-13",
    state: "ready",
    url: undefined,
    sessionStart: undefined,
    sessionEnd: undefined,
    createdAt: "Mar 13, 2025, 07:45 AM"
  },
  {
    id: 'run_k1l2m3n4o5',
    image: {
      name: "DevOps Toolchain",
      description: "Environment with Docker, Kubernetes, Terraform, and CI/CD tools",
      identifier: "img_b6c2d8e3f5",
      machine: {
        name: "Large",
        identifier: "t2.large",
        cpuCount: 2,
        memorySize: 8,
        storageSize: 100,
        id: 3
      },
      active: true,
      createdOn: "Feb 20, 2025",
      updatedOn: "Mar 05, 2025",
      id: 3,
      runnerPoolSize: 1
    },
    keyPairName: "KeyPair-2025-03-13",
    state: "awaiting_client",
    user: "sarah.smith@revature.com",
    url: "https://ide.revature.com/run_k1l2m3n4o5",
    sessionStart: "Mar 13, 2025, 09:15 AM",
    sessionEnd: "Mar 13, 2025, 12:15 PM",
    createdAt: "Mar 13, 2025, 09:00 AM"
  },
  {
    id: 'run_p6q7r8s9t0',
    image: {
      name: "Go Development",
      description: "Lightweight Go development environment",
      identifier: "img_w7x9y2z4a1",
      machine: {
        name: "Medium",
        identifier: "t2.medium",
        cpuCount: 2,
        memorySize: 4,
        storageSize: 50,
        id: 4
      },
      active: true,
      createdOn: "Feb 15, 2025",
      updatedOn: "Mar 01, 2025",
      id: 4,
      runnerPoolSize: 1
    },
    keyPairName: "KeyPair-2025-03-12",
    state: "starting",
    createdAt: "Mar 13, 2025, 09:30 AM"
  },
  {
    id: 'run_u1v2w3x4y5',
    image: {
      name: "Ubuntu Developer",
      description: "Standard Ubuntu development environment with common development tools",
      identifier: "img_a7b3c9d2e5",
      machine: {
        name: "Medium",
        identifier: "t2.medium",
        cpuCount: 2,
        memorySize: 4,
        storageSize: 50,
        id: 5
      },
      active: true,
      createdOn: "Jan 15, 2025",
      updatedOn: "Feb 20, 2025",
      id: 5,
      runnerPoolSize: 1
    },
    keyPairName: "KeyPair-2025-03-12",
    state: "terminated",
    user: "alex.johnson@revature.com",
    sessionStart: "Mar 12, 2025, 02:00 PM",
    sessionEnd: "Mar 12, 2025, 05:00 PM",
    createdAt: "Mar 12, 2025, 01:45 PM"
  }
];

// Define the context type
interface RunnersContextType {
  runners: Runner[];
  addRunner: (runner: NewRunner) => void;
  updateRunnerState: (id: string, state: RunnerState) => void;
  getRunnerById: (id: number) => Runner | undefined;
  terminateRunner: (id: string) => void;
}

// Create the context with default values
const RunnersContext = createContext<RunnersContextType>({
  runners: [],
  addRunner: () => {},
  updateRunnerState: () => {},
  getRunnerById: () => undefined,
  terminateRunner: () => {}
});

// Provider component
interface RunnersProviderProps {
  children: ReactNode;
}

export const RunnersProvider: React.FC<RunnersProviderProps> = ({ children }) => {
  const [runners, setRunners] = useState<Runner[]>(initialRunners);

  // Add a new runner
  const addRunner = (runner: NewRunner) => {
    const now = new Date();
    const sessionStart = new Date();
    const sessionEnd = calculateSessionEnd(sessionStart, runner.durationMinutes);

    const newRunner: Runner = {
      id: generateRandomId(),
      image: runner.image,
      keyPairName: generateKeyPairName(),
      state: "starting", // Initial state
      createdAt: formatDate(now),
      sessionStart: formatDate(sessionStart),
      sessionEnd: formatDate(sessionEnd),
      // URL will be generated when the runner is ready
    };

    setRunners(prev => [...prev, newRunner]);

    // Simulate the runner becoming ready after a delay (in a real app, this would come from the backend)
    setTimeout(() => {
      updateRunnerState(newRunner.id, "ready");
    }, 10000); // 10 seconds
  };

  // Update runner state
  const updateRunnerState = (id: string, state: RunnerState) => {
    setRunners(prev => {
      return prev.map(runner => {
        if (runner.id === id) {
          // If transitioning to ready state, add a URL
          const updates: Partial<Runner> = { state };
          
          if (state === "ready") {
            updates.url = `https://ide.revature.com/${id}`;
          }
          
          return { ...runner, ...updates };
        }
        return runner;
      });
    });
  };

  // Get runner by ID
  const getRunnerById = (index: number): Runner | undefined => {
    return runners[index];
  };

  // Terminate a runner
  const terminateRunner = (id: string) => {
    updateRunnerState(id, "terminated");
  };

  return (
    <RunnersContext.Provider value={{ 
      runners, 
      addRunner, 
      updateRunnerState,
      getRunnerById,
      terminateRunner
    }}>
      {children}
    </RunnersContext.Provider>
  );
};

// Custom hook for using the context
export const useRunners = () => useContext(RunnersContext);

export default RunnersContext;