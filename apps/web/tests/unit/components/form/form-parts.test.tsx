import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormWrapper,
  FormInput,
  FormSelect,
} from "@/components/form/form-parts";

// ----------------------------------------------------------------
// テストハーネス: 各コンポーネントをuseFormでラップして実際のRHFコンテキスト内で検証する
// ----------------------------------------------------------------

const wrapperSchema = z.object({
  title: z.string().min(1, "タイトルは必須です"),
});
type WrapperFormValues = z.infer<typeof wrapperSchema>;

const FormWrapperHarness = ({
  onSubmit,
  defaultTitle = "",
}: {
  onSubmit: (values: WrapperFormValues) => void;
  defaultTitle?: string;
}) => {
  const form = useForm<WrapperFormValues>({
    resolver: zodResolver(wrapperSchema),
    defaultValues: { title: defaultTitle },
  });

  return (
    <FormWrapper onSubmit={onSubmit} form={form}>
      <FormInput label="タイトル" name="title" />
      <button type="submit">送信</button>
    </FormWrapper>
  );
};

const selectSchema = z.object({
  priority: z.string().min(1, "選択してください"),
});
type SelectFormValues = z.infer<typeof selectSchema>;

const FormSelectHarness = ({
  options = [
    { value: "LOW", label: "低" },
    { value: "MEDIUM", label: "中" },
    { value: "HIGH", label: "高" },
  ],
  defaultPriority = "",
}: {
  options?: readonly { value: string; label: string }[];
  defaultPriority?: string;
}) => {
  const form = useForm<SelectFormValues>({
    resolver: zodResolver(selectSchema),
    defaultValues: { priority: defaultPriority },
  });

  return (
    <FormWrapper onSubmit={vi.fn()} form={form}>
      <FormSelect
        label="優先度"
        name="priority"
        options={options}
        placeholder="優先度を選択"
      />
    </FormWrapper>
  );
};

describe("FormWrapper + FormInput", () => {
  it("labelとinputが表示され、childrenがレンダリングされる", () => {
    render(<FormWrapperHarness onSubmit={vi.fn()} />);

    expect(screen.getByText("タイトル")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
  });

  it("defaultValuesが入力欄に反映される", () => {
    render(
      <FormWrapperHarness onSubmit={vi.fn()} defaultTitle="初期タイトル" />,
    );

    expect(screen.getByDisplayValue("初期タイトル")).toBeInTheDocument();
  });

  it("値を入力して送信するとonSubmitが値付きで呼ばれる", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<FormWrapperHarness onSubmit={handleSubmit} />);

    await user.type(screen.getByRole("textbox"), "新規タスク");
    await user.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        { title: "新規タスク" },
        expect.anything(),
      );
    });
  });

  it("バリデーションエラー時はonSubmitが呼ばれずFormMessageが表示される", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<FormWrapperHarness onSubmit={handleSubmit} />);

    await user.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(screen.getByText("タイトルは必須です")).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("追加のInputHTMLAttributes（placeholder）がinputへ伝播する", () => {
    const wrapperSchemaWithPlaceholder = wrapperSchema;
    const Harness = () => {
      const form = useForm<WrapperFormValues>({
        resolver: zodResolver(wrapperSchemaWithPlaceholder),
        defaultValues: { title: "" },
      });
      return (
        <FormWrapper onSubmit={vi.fn()} form={form}>
          <FormInput
            label="タイトル"
            name="title"
            placeholder="例: レポートを作成する"
          />
        </FormWrapper>
      );
    };

    render(<Harness />);

    expect(
      screen.getByPlaceholderText("例: レポートを作成する"),
    ).toBeInTheDocument();
  });
});

describe("FormSelect", () => {
  it("labelとplaceholderが表示される", () => {
    render(<FormSelectHarness />);

    expect(screen.getByText("優先度")).toBeInTheDocument();
    expect(screen.getByText("優先度を選択")).toBeInTheDocument();
  });

  it("defaultValuesに応じた選択済みラベルが表示される", () => {
    render(<FormSelectHarness defaultPriority="HIGH" />);

    expect(screen.getByRole("combobox", { name: /優先度/i })).toHaveTextContent(
      "高",
    );
  });

  it("optionsが空の場合はdisabledになる", () => {
    render(<FormSelectHarness options={[]} />);

    expect(screen.getByRole("combobox", { name: /優先度/i })).toBeDisabled();
  });

  it("optionsがある場合はdisabledにならない", () => {
    render(<FormSelectHarness />);

    expect(screen.getByRole("combobox", { name: /優先度/i })).not.toBeDisabled();
  });
});