import { useState, useEffect } from 'react';

// Define proper interfaces for our components
interface InteractiveTerminalProps {
  logs: string[];
  simulationComplete: boolean;
  onCommand?: (command: string) => void;
  allowInput?: boolean;
}

interface FallbackTerminalProps {
  logs: string[];
}

// Define module types without directly importing unused types
interface XtermModules {
  xterm: typeof import('@xterm/xterm') | null;
  fitAddon: typeof import('@xterm/addon-fit') | null;
  webLinksAddon: typeof import('@xterm/addon-web-links') | null;
}

/**
 * A hook that dynamically imports terminal components and xterm modules.
 * This combines both terminal component loading and xterm module loading in one hook.
 */
export const useTerminal = () => {
  // Terminal components
  const [InteractiveTerminal, setInteractiveTerminal] = useState<React.ComponentType<InteractiveTerminalProps> | null>(null);
  const [FallbackTerminal, setFallbackTerminal] = useState<React.ComponentType<FallbackTerminalProps> | null>(null);
  
  // XTerm modules
  const [modules, setModules] = useState<XtermModules>({
    xterm: null,
    fitAddon: null,
    webLinksAddon: null
  });

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return; // Skip on server-side

    const loadTerminalComponents = async () => {
      try {
        // Parallel loading of components and modules
        const [
          interactiveModule, 
          fallbackModule,
          xtermModule,
          fitAddonModule,
          webLinksAddonModule
        ] = await Promise.all([
          import('@/components/terminal/InteractiveTerminal'),
          import('@/components/terminal/FallbackTerminal'),
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
          import('@xterm/addon-web-links')
        ]);
        
        // Set component modules
        setInteractiveTerminal(() => interactiveModule.default);
        setFallbackTerminal(() => fallbackModule.default);
        
        // Set xterm modules
        setModules({
          xterm: xtermModule,
          fitAddon: fitAddonModule,
          webLinksAddon: webLinksAddonModule
        });
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading terminal components or modules:', err);
        setError(err instanceof Error ? err : new Error('Unknown error loading terminal components or modules'));
        
        // Try to at least load the fallback terminal
        try {
          const fallbackModule = await import('@/components/terminal/FallbackTerminal');
          setFallbackTerminal(() => fallbackModule.default);
        } catch (fallbackErr) {
          console.error('Error loading fallback terminal:', fallbackErr);
        }
        
        setLoading(false);
      }
    };

    loadTerminalComponents();
  }, []);

  return { 
    InteractiveTerminal, 
    FallbackTerminal, 
    modules,
    loading, 
    error 
  };
};

// For backwards compatibility, keep these separate hooks that use the combined hook internally
export const useDynamicTerminal = () => {
  const { InteractiveTerminal, FallbackTerminal, loading, error } = useTerminal();
  return {
    Terminal: InteractiveTerminal,
    FallbackTerminal,
    loading,
    error
  };
};

export const useXtermModules = () => {
  const { modules, loading, error } = useTerminal();
  
  // Handle the case where modules or its properties might be null
  const safeModules = {
    xterm: modules.xterm || null,
    fitAddon: modules.fitAddon || null,
    webLinksAddon: modules.webLinksAddon || null
  };
  
  return { 
    modules: safeModules, 
    loading, 
    error 
  };
};

export default useTerminal;