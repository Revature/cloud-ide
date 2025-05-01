"use client";

import { scriptsApi } from "@/services/cloud-resources/scripts";
import { Script } from "@/types/scripts";
import { QueryKey, useQuery, UseQueryResult } from "@tanstack/react-query";

// Overloaded function signatures
function useScriptsQuery(): UseQueryResult<Script[], Error>;
function useScriptsQuery(id: number): UseQueryResult<Script, Error>;

// Implementation
function useScriptsQuery(id?: number): UseQueryResult<Script | Script[], Error> {
  const queryKey: QueryKey = id ? ["scripts", id] : ["scripts"];

  const queryFn = async (): Promise<Script | Script[]> =>
    id ? scriptsApi.getById(id) : scriptsApi.getAll();

  const queryResult = useQuery({
    queryKey: queryKey,
    queryFn: queryFn,
    enabled: id ? !!id : true, // Only fetch if ID is provided
  });

  return queryResult;
}

export { useScriptsQuery };