import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { useDocumentTitle } from "../components/LocationPlate.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Link } from "../components/ui/Link.tsx";
import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import { isServerTrouble, RECOVER_MS } from "../lib/query.ts";
import { HazardStripe } from "../pixel/HazardStripe.tsx";
import { PixelText } from "../pixel/PixelText.tsx";
import { PixelSprite } from "../pixel/SpriteLayers.tsx";
import { SPRITE_ID, TILE_SIZE, TILE_SPRITES } from "../pixel/tiles.ts";
import { useIsInShell } from "./AppShell.tsx";
import "./StatusScreens.css";

const RUBBLE_COLUMNS = new Set([2, 3]);
const SCENE_COLUMNS = 7;
const ROBOT_COLUMN = 2;

function Tile({ ids }: { ids: readonly string[] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${TILE_SIZE} ${TILE_SIZE}`}
      shapeRendering="crispEdges"
      className="status-tile"
    >
      {ids.map((id) => (
        <use key={id} href={`#${id}`} />
      ))}
    </svg>
  );
}

function CaveIn() {
  const columns = Array.from({ length: SCENE_COLUMNS }, (_, index) => index);
  return (
    <div aria-hidden="true" className="status-scene">
      {columns.map((col) =>
        RUBBLE_COLUMNS.has(col) ? (
          <span key={`w${col.toString()}`} className="status-rubble">
            <Tile ids={[SPRITE_ID.floor(col % 3)]} />
            <PixelSprite sprite={TILE_SPRITES.rubble} className="status-rubble-art" />
          </span>
        ) : (
          <Tile key={`w${col.toString()}`} ids={[SPRITE_ID.wall(col % 2)]} />
        ),
      )}
      {columns.map((col) => (
        <span key={`f${col.toString()}`} className="status-floor">
          <Tile ids={[SPRITE_ID.floor((col + 1) % 3)]} />
          {col === ROBOT_COLUMN ? (
            <PixelSprite
              sprite={TILE_SPRITES.robot}
              className="status-robot"
              animated={{ lamp: "px-lamp-broken", visor: "px-lamp-broken" }}
            />
          ) : null}
        </span>
      ))}
    </div>
  );
}

type SignBoardProps = {
  heading: string;
  plate: string;
  code?: string;
  isAlert?: boolean;
  children: ReactNode;
};

function SignBoard({ heading, plate, code, isAlert = false, children }: SignBoardProps) {
  const isInShell = useIsInShell();
  useDocumentTitle();
  const board = (
    <div className="status" data-in-shell={isInShell} {...(isAlert ? { role: "alert" } : {})}>
      <HazardStripe />
      <div className="status-body">
        <h1 className="visually-hidden">{heading}</h1>
        {code ? <PixelText text={code} scale={6} className="status-code" /> : null}
        <span aria-hidden="true" className="status-plate">
          {plate.split(" ").map((word) => (
            <PixelText key={word} text={word} scale={4} />
          ))}
        </span>
        {children}
      </div>
      <HazardStripe />
    </div>
  );
  if (isInShell) {
    return board;
  }
  return (
    <main id="main" tabIndex={-1} className="status-page">
      {board}
    </main>
  );
}

export function NotFound() {
  return (
    <SignBoard heading={hu.app.notFoundTitle} plate={hu.signs.notFound} code="404">
      <CaveIn />
      <p className="status-text">{hu.app.notFoundBody}</p>
      <Link to="/maps" variant="primary" icon="grid">
        {hu.app.backToMaps}
      </Link>
    </SignBoard>
  );
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const isTrouble = isServerTrouble(error);
  useEffect(() => {
    if (!isTrouble) {
      return;
    }
    const timer = window.setInterval(() => {
      reset();
      void router.invalidate();
    }, RECOVER_MS);
    return () => window.clearInterval(timer);
  }, [isTrouble, reset, router]);
  return (
    <SignBoard heading={hu.signs.error} plate={hu.signs.error} isAlert>
      <CaveIn />
      <p className="status-text">
        {isTrouble ? hu.app.serverTrouble : errorMessage(error, hu.app.unexpected)}
      </p>
      {isTrouble ? <p className="status-text">{hu.app.serverTroubleBody}</p> : null}
      <Button
        variant="primary"
        icon="rewind"
        onPress={() => {
          reset();
          void router.invalidate();
        }}
      >
        {hu.app.retry}
      </Button>
    </SignBoard>
  );
}
