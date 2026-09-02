import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { expect, it } from "vitest";
import WatchFind, { loader } from "./watch-find";

it("renders an email-free, provider-free finder shell with validated handoff", async () => {
  const Stub = createRoutesStub([
    {
      path: "/watches/find",
      Component: WatchFind,
      loader: (args) => loader(args),
    },
  ]);
  render(
    <Stub
      initialEntries={[
        "/watches/find?socialSignal=anti_luxury&aestheticDna=structural_tool",
      ]}
    />,
  );
  expect(
    await screen.findByRole("heading", {
      name: "Find a watch through a story",
    }),
  ).toBeInTheDocument();
  const anchors = screen.getAllByRole("button");
  expect(anchors).toHaveLength(3);
  anchors.forEach((anchor) => expect(anchor).toBeDisabled());
  expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  expect(
    screen.getByText(/does not send a research request/i),
  ).toBeInTheDocument();
});
