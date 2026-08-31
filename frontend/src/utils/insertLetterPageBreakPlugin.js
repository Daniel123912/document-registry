import { ButtonView, Command, Plugin } from "ckeditor5";
import { insertLetterPageBreak } from "./letterPageLayout";

const PAGE_BREAK_ICON =
  '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M4 2.5h12a1 1 0 0 1 1 1V7H3V3.5a1 1 0 0 1 1-1z"/><path d="M3 9.5h14" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.5 2"/><path d="M4 10.5h12a1 1 0 0 1 1 1V16.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z"/></svg>';

class InsertLetterPageBreakCommand extends Command {
  refresh() {
    this.isEnabled = !this.editor.isReadOnly;
  }

  execute() {
    insertLetterPageBreak({ current: this.editor });
  }
}

export class InsertLetterPageBreak extends Plugin {
  static get pluginName() {
    return "InsertLetterPageBreak";
  }

  init() {
    const editor = this.editor;

    editor.commands.add("insertLetterPageBreak", new InsertLetterPageBreakCommand(editor));

    editor.ui.componentFactory.add("insertLetterPageBreak", (locale) => {
      const command = editor.commands.get("insertLetterPageBreak");
      const view = new ButtonView(locale);

      view.set({
        label: "Разрыв страницы",
        icon: PAGE_BREAK_ICON,
        tooltip: "Разрыв страницы (Ctrl+Enter)",
      });

      view.bind("isEnabled").to(command);

      this.listenTo(view, "execute", () => {
        editor.execute("insertLetterPageBreak");
        editor.editing.view.focus();
      });

      return view;
    });
  }
}
