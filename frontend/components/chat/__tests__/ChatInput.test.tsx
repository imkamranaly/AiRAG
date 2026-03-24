import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatInput from "../ChatInput";

describe("ChatInput", () => {
  it("renders placeholder text", () => {
    render(<ChatInput onSubmit={jest.fn()} placeholder="Type here…" />);
    expect(screen.getByPlaceholderText("Type here…")).toBeInTheDocument();
  });

  it("calls onSubmit with trimmed value on button click", async () => {
    const onSubmit = jest.fn();
    render(<ChatInput onSubmit={onSubmit} />);

    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "  hello world  ");

    fireEvent.click(screen.getByText("Send"));
    expect(onSubmit).toHaveBeenCalledWith("hello world");
  });

  it("does not submit empty input", () => {
    const onSubmit = jest.fn();
    render(<ChatInput onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("Send"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows Stop button when streaming", () => {
    const onStop = jest.fn();
    render(<ChatInput onSubmit={jest.fn()} onStop={onStop} isStreaming />);
    const stopBtn = screen.getByText("Stop");
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalled();
  });

  it("clears input after submit", async () => {
    render(<ChatInput onSubmit={jest.fn()} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    await userEvent.type(textarea, "test query");
    fireEvent.click(screen.getByText("Send"));
    expect(textarea.value).toBe("");
  });
});
