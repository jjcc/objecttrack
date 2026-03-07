"use client";

import React, {
  type PropsWithChildren,
  createContext,
  useCallback,
  useState,
} from "react";
import {
  ColorScheme,
  ColorSchemeProvider,
  MantineProvider,
} from "@mantine/core";
import Cookies from "js-cookie";

type ColorModeContextType = {
  mode: string;
  setMode: () => void;
};

export const ColorModeContext = createContext<ColorModeContextType>(
  {} as ColorModeContextType
);

type ColorModeContextProviderProps = {
  defaultMode?: string;
};

export const ColorModeContextProvider: React.FC<
  PropsWithChildren<ColorModeContextProviderProps>
> = ({ children, defaultMode }) => {
  const [colorScheme, setColorScheme] = useState<ColorScheme>(
    (defaultMode as ColorScheme) || "light"
  );

  const toggleColorScheme = useCallback(() => {
    const next = colorScheme === "dark" ? "light" : "dark";
    setColorScheme(next);
    Cookies.set("theme", next);
  }, [colorScheme]);

  return (
    <ColorModeContext.Provider
      value={{ mode: colorScheme, setMode: toggleColorScheme }}
    >
      <ColorSchemeProvider
        colorScheme={colorScheme}
        toggleColorScheme={toggleColorScheme}
      >
        <MantineProvider theme={{ colorScheme }}>
          {children}
        </MantineProvider>
      </ColorSchemeProvider>
    </ColorModeContext.Provider>
  );
};
