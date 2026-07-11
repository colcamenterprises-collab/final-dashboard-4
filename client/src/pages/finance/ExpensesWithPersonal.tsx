import Expenses from "./Expenses";
import { PersonalExpensesTable } from "@/components/PersonalExpensesTable";

export default function ExpensesWithPersonal() {
  return (
    <>
      <Expenses />
      <div className="mx-auto max-w-7xl p-4 pt-0">
        <PersonalExpensesTable dateFrom="" dateTo="" />
      </div>
    </>
  );
}
