import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, call } from "../lib/api.ts";

export const PROGRAM_SORTS = ["recent", "title"] as const;

export type ProgramSort = (typeof PROGRAM_SORTS)[number];

export type ProgramParams = { q: string; sort: ProgramSort; page: number };

export const PROGRAM_PAGE_SIZE = 8;

const fetchPrograms = (params: ProgramParams) =>
  call(
    api.programs.$get({
      query: {
        q: params.q,
        sort: params.sort,
        page: String(params.page),
        pageSize: String(PROGRAM_PAGE_SIZE),
      },
    }),
  );

export type ProgramPage = Awaited<ReturnType<typeof fetchPrograms>>;

export type ProgramListItem = ProgramPage["programs"][number];

const PROGRAMS_KEY = ["programs"] as const;

export const programsQuery = (params: ProgramParams) =>
  queryOptions({
    queryKey: [...PROGRAMS_KEY, params],
    queryFn: () => fetchPrograms(params),
    placeholderData: keepPreviousData,
  });

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAMS_KEY }),
  });
}

export function useDeleteProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => call(api.programs[":id"].$delete({ param: { id: String(id) } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAMS_KEY }),
  });
}
