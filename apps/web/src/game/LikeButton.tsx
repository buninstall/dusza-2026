import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ToggleButton } from "react-aria-components";
import { toast } from "../components/ui/Toast.tsx";
import { hu } from "../i18n/hu.ts";
import { errorMessage } from "../lib/api.ts";
import { likeMap } from "../maps/queries.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import "./LikeButton.css";

type LikeButtonProps = { mapId: number; likes: number; likedByMe: boolean; hasPlayed: boolean };

export function LikeButton({ mapId, likes, likedByMe, hasPlayed }: LikeButtonProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (liked: boolean) => likeMap(mapId, liked),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["map", mapId] });
      void queryClient.invalidateQueries({ queryKey: ["maps"] });
    },
    onError: (error) => toast.error(errorMessage(error, hu.game.likeFailed)),
  });
  const isLiked = mutation.isPending ? (mutation.variables ?? likedByMe) : likedByMe;
  return (
    <ToggleButton
      isSelected={isLiked}
      isDisabled={mutation.isPending}
      onChange={(next) => {
        if (!hasPlayed) {
          toast.info(hu.game.likeHint);
          return;
        }
        mutation.mutate(next);
      }}
      className="btn like-button"
      data-variant="ghost"
      data-size="sm"
    >
      <PixelIcon name="heart" />
      {hu.game.like}
      <span className="like-count">{likes}</span>
    </ToggleButton>
  );
}
