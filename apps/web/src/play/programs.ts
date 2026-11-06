import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, call } from "../lib/api.ts";

const fetchPrograms = () => call(api.programs.$get());

export type ProgramListItem = Awaited<ReturnType<typeof fetchPrograms>>["programs"][number];

export const programsQuery = queryOptions({ queryKey: ["programs"], queryFn: fetchPrograms });

export function fetchProgram(id: number) {
  return call(api.programs[":id"].$get({ param: { id: String(id) } }));
}

export type SavedProgram = Awaited<ReturnType<typeof fetchProgram>>["program"];

type SaveInput = { id: number | null; title: string; source: string };

export function useSaveProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title, source }: SaveInput) =>
      id === null
        ? call(api.programs.$post({ json: { title, source } }))
        : call(api.programs[":id"].$put({ param: { id: String(id) }, json: { title, source } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: programsQuery.queryKey }),
  });
}

export function useDeleteProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => call(api.programs[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: programsQuery.queryKey }),
  });
}
