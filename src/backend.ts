import { workshop } from "./workshop";
const dispatch = workshop(spindle);
spindle.onFrontendMessage(async (request, userId, frontendSessionId) => {
  if (request?.type !== "workshop" || !userId) return;
  let response;
  try {
    response = { data: await dispatch(userId, request) };
  } catch (error) {
    response = { error: error.message || "Workshop request failed." };
  }
  spindle.sendToFrontend(
    { type: "workshop_result", requestId: request.requestId, ...response },
    userId,
    { frontendSessionId },
  );
});
