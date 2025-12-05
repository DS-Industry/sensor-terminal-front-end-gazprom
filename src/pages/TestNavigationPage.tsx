import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function TestNavigationPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const testScreens = [
    {
      title: "Error Launch - Variant 1",
      description: "Ошибка запуска робота!",
      route: "/error?variant=1",
      color: "bg-red-500"
    },
    {
      title: "Error Launch - Variant 2",
      description: "Ошибка запуска робота! (with instructions)",
      route: "/error?variant=2",
      color: "bg-red-600"
    },
    {
      title: "Washing In Progress",
      description: "Идёт мойка... (with pay in advance option)",
      route: "/washing",
      color: "bg-blue-500"
    },
    {
      title: "Success - Initial",
      description: "Проезжайте в бокс! (car animation)",
      route: "/success",
      color: "bg-green-500"
    },
    {
      title: "Success - Advance Payment",
      description: "Ожидайте окончания мойки... (after advance payment)",
      route: "/success?state=advance",
      color: "bg-green-600"
    }
  ];

  return (
    <div className="min-h-screen w-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">
          🧪 Test Navigation - All Screens
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testScreens.map((screen, index) => (
            <div
              key={index}
              className={`${screen.color} rounded-2xl p-6 text-white shadow-lg hover:scale-105 transition-transform cursor-pointer`}
              onClick={() => navigate(screen.route)}
            >
              <h2 className="text-2xl font-bold mb-3">{screen.title}</h2>
              <p className="text-white/90 mb-4">{screen.description}</p>
              <button
                className="bg-white text-gray-800 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(screen.route);
                }}
              >
                Test →
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-white rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Quick Links</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
            >
              Main Page
            </button>
            <button
              onClick={() => navigate("/error")}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
            >
              Error Page
            </button>
            <button
              onClick={() => navigate("/success")}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
            >
              Success Page
            </button>
            <button
              onClick={() => navigate("/washing")}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700"
            >
              Washing Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

