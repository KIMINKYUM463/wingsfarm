type MassageProps = {
  message?: string;
};

export default function EmptyState({ message = '표시할 항목이 없습니다.' }: MassageProps) {
  return (
    <div className="p-6 h-[60vh] flex-center text-gray-400">
      <h2>{message}</h2>
    </div>
  );
}
