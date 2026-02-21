import Header from "@/components/layout/Header";
import SplitPane from "@/components/layout/SplitPane";
import ChatPane from "@/components/chat/ChatPane";
import DocumentPane from "@/components/document/DocumentPane";

export default function Home() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <SplitPane
        left={<ChatPane />}
        right={<DocumentPane />}
      />
    </div>
  );
}
